import {firestore} from "firebase-admin";
import {Collections} from "../data/Collections";
import {ChatMessage} from "../data/ChatMessage";
import {tagLogger} from "../../logging";
import CollectionReference = firestore.CollectionReference;
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {scheduleCommand, TaskScheduler} from "../TaskScheduler";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {ChatMeta, Meta} from "../data/Meta";
import Query = firestore.Query;
import {BoundChatCommand, ChatAction, ChatCommand, isBoundChatCommand} from "../data/ChatCommand";
import {ChatWorker, DispatchControl} from "./ChatWorker";
import {DispatchRunner} from "./DispatchRunner";
import {ChatCleaner} from "./ChatCleaner";
import {isStructuredMessage, NewMessage} from "../data/NewMessage";
import FieldValue = firestore.FieldValue;
import {MessageMiddleware, MessageProcessingControl} from "../middleware/MessageMiddleware";
import DocumentReference = firestore.DocumentReference;
import {Dispatch} from "../data/Dispatch";

const logger = tagLogger("BaseChatWorker");

/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
export abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ChatWorker {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    private readonly runner: DispatchRunner<A, AC, DATA, CM>;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     */
    protected constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean) {
        this.db = firestore;
        this.scheduler = scheduler;
        this.runner = new DispatchRunner(firestore, scheduler, cleaner, logData);
    }

    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        if (this.isSupportedCommand(req)) {
            logger.d("Dispatching command: ", JSON.stringify(req.data));
            await this.dispatchWithCheck(req, onQueueComplete, async (command, state, control) => {
                return await this.doDispatch(command, state, control);
            });
            return true;
        }
        return false;
    }

    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected abstract isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<A>>

    /**
     * Dispatch template
     * @param command Command to dispatch
     * @param state Current chat state
     * @param control Continuation control
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected abstract doDispatch(
        command: ChatCommand<A>,
        state: ChatState<AC, DATA, CM>,
        control: DispatchControl<DATA, CM>
    ): Promise<void>

    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @protected
     */
    protected getMessageCollection(chatDocumentPath: string): CollectionReference<ChatMessage> {
        return this.db
            .doc(chatDocumentPath)
            .collection(Collections.messages) as CollectionReference<ChatMessage>;
    }

    /**
     * Creates chat message query
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Collection query to get chat messages
     * @protected
     */
    private getThreadMessageQuery(chatDocumentPath: string, dispatchId?: string): Query<ChatMessage> {
        let query: Query<ChatMessage> = this.getMessageCollection(chatDocumentPath);
        if (undefined !== dispatchId) {
            query = query.where("dispatchId", "==", dispatchId);
        }
        return query;
    }

    /**
     * Retrieves chat messages
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Chat messages if any
     * @protected
     */
    protected async getMessages(chatDocumentPath: string, dispatchId?: string): Promise<ReadonlyArray<ChatMessage>> {
        const messages = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex")
            .get();
        const result: Array<ChatMessage> = [];
        messages.docs.forEach((doc) => {
            const data = doc.data();
            if (undefined !== data) {
                result.push(data);
            }
        });
        return result;
    }

    /**
     * Saves chat messages
     * @param tx Update transaction
     * @param nextInBatchIndex Next index in batch
     * @param ownerId Chat owner
     * @param chatDocumentPath Chat document path
     * @param dispatchId Dispatch ID
     * @param sessionId Session ID
     * @param messages A list of messages to save
     * @param chatMeta Chat metadata
     * @protected
     */
    private saveMessages(
        tx: FirebaseFirestore.Transaction,
        nextInBatchIndex: number,
        ownerId: string,
        chatDocumentPath: string,
        dispatchId: string,
        sessionId: string | null | undefined,
        messages: ReadonlyArray<NewMessage>,
        chatMeta?: CM | null
    ): number {
        const messageCollectionRef = this.getMessageCollection(chatDocumentPath);
        messages.forEach((message) => {
            let text: string;
            let data: Readonly<Record<string, unknown>> | null = null;
            let meta: Meta | null = chatMeta?.aiMessageMeta || null;
            if (isStructuredMessage(message)) {
                text = message.text;
                data = message.data || null;
                if (message.meta) {
                    if (null != meta) {
                        meta = {...meta, ...message.meta};
                    } else {
                        meta = message.meta;
                    }
                }
            } else {
                text = String(message);
            }
            tx.set(
                messageCollectionRef.doc(),
                {
                    userId: ownerId,
                    dispatchId: dispatchId,
                    author: "ai",
                    text: text,
                    data: data,
                    inBatchSortIndex: nextInBatchIndex++,
                    createdAt: FieldValue.serverTimestamp(),
                    meta: meta,
                    ...(sessionId ? {sessionId: sessionId} : {})
                }
            );
        });
        return nextInBatchIndex;
    }

    /**
     * Runs AI message processing
     * @param command Chat command
     * @param chatState Current chat state
     * @param defaultProcessor Default message processor
     * @param control Dispatch control
     * @param middleware Message middleware
     * @param messages Messages to process
     * @protected
     */
    protected async processMessages(
        command: ChatCommand<A>,
        chatState: ChatState<AssistantConfig, DATA, CM>,
        defaultProcessor: MessageMiddleware<DATA, CM>,
        control: DispatchControl<DATA, CM>,
        middleware: ReadonlyArray<MessageMiddleware<DATA, CM>>,
        messages: ReadonlyArray<NewMessage>
    ): Promise<void> {
        let currentChatState: ChatState<AssistantConfig, DATA, CM> = chatState;

        const createMpControl = (next: (messages: ReadonlyArray<NewMessage>) => Promise<void>): MessageProcessingControl<DATA, CM> => {
            return {
                safeUpdate: async (update) => {
                    return await control.safeUpdate(async (tx, updateChatState) => {
                        const dispatchDoc = this.db.doc(command.commonData.chatDocumentPath).collection(Collections.dispatches).doc(command.commonData.dispatchId) as DocumentReference<Dispatch>;
                        let nextMessageIndex = (await dispatchDoc.get())?.data()?.nextMessageIndex || 0;
                        await update(
                            tx,
                            (newState) => {
                                const update = {
                                    ...(newState.config ? {config: newState.config} : {}),
                                    ...(newState.status ? {status: newState.status} : {}),
                                    ...(newState.data ? {data: newState.data} : {}),
                                    ...(newState.meta ? {meta: newState.meta} : {}),
                                    ...(newState.sessionId ? {sessionId: newState.sessionId} : {})
                                };
                                currentChatState = Object.assign(currentChatState, update);
                                updateChatState(update);
                            },
                            (messages) => {
                                nextMessageIndex = this.saveMessages(
                                    tx,
                                    nextMessageIndex,
                                    command.commonData.ownerId,
                                    command.commonData.chatDocumentPath,
                                    command.commonData.dispatchId,
                                    chatState.sessionId,
                                    messages,
                                    chatState.meta
                                );
                            }
                        );
                        tx.set(dispatchDoc, {nextMessageIndex: nextMessageIndex}, {merge: true});
                    });
                },
                next: next,
                enqueue: control.schedule,
                completeQueue: control.completeQueue
            };
        };

        let start: (messages: ReadonlyArray<NewMessage>) => Promise<void> = async (messages: ReadonlyArray<NewMessage>) => {
            await defaultProcessor(
                messages,
                command.commonData.chatDocumentPath,
                currentChatState,
                createMpControl(() => Promise.resolve())
            );
        };

        for (let i = middleware.length - 1; i >= 0; --i) {
            const mpControl = createMpControl(start);
            start = (messages: ReadonlyArray<NewMessage>) => {
                return middleware[i](
                    messages,
                    command.commonData.chatDocumentPath,
                    currentChatState,
                    mpControl
                );
            };
        }

        await start(messages);
    }

    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    private async dispatchWithCheck(
        req: Request<ChatCommand<A>>,
        onQueueComplete: ((chatDocumentPath: string, meta: Meta | null) => void | Promise<void>) | undefined,
        processAction: (
            command: ChatCommand<A>,
            state: ChatState<AC, DATA, CM>,
            control: DispatchControl<DATA, CM>
        ) => Promise<void>
    ): Promise<void> {
        return this.runner.dispatchWithCheck(
            req,
            async (soFar, chatCommand, safeUpdate) => {
                const command = isBoundChatCommand(chatCommand) ? chatCommand.command : chatCommand;
                const control: DispatchControl<DATA, CM> = {
                    safeUpdate: safeUpdate,
                    schedule: async (command) => {
                        logger.d("Scheduling command: ", JSON.stringify(command));
                        return scheduleCommand(this.scheduler, req.queueName, command);
                    },
                    continueQueue: async (next: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => {
                        logger.d("Scheduling next step: ", JSON.stringify(next));
                        let command: ChatCommand<A>;
                        let queueName = req.queueName;
                        if (isBoundChatCommand(chatCommand)) {
                            command = chatCommand.command;
                            queueName = chatCommand.queueName;
                        } else {
                            command = <ChatCommand<A>>next;
                        }
                        if (command.commonData.dispatchId === soFar.latestDispatchId) {
                            await this.scheduler.schedule(queueName, command);
                            logger.d("Command scheduled");
                            return true;
                        }
                        logger.d("Chat is dispatching another command. Ignoring...");
                        return false;
                    },
                    completeQueue: async () => {
                        logger.d("Command queue complete");
                        if (undefined !== onQueueComplete) {
                            logger.d("Running queue complete handler...");
                            try {
                                await onQueueComplete(command.commonData.chatDocumentPath, command.commonData.meta);
                            } catch (e: unknown) {
                                logger.w("Error running complete handler", e);
                            }
                        }
                    }
                };
                await processAction(command, soFar, control);
            }
        );
    }
}
