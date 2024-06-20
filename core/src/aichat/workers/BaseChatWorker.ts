import {firestore} from "firebase-admin";
import {Collections} from "../data/Collections";
import {ChatMessage} from "../data/ChatMessage";
import {tagLogger} from "../../logging";
import CollectionReference = firestore.CollectionReference;
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {TaskScheduler} from "../TaskScheduler";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {Meta} from "../data/Meta";
import Query = firestore.Query;
import {BoundChatCommand, ChatCommand, isBoundChatCommand} from "../data/ChatCommand";
import {ChatWorker, DispatchControl} from "./ChatWorker";
import {DispatchRunner} from "./DispatchRunner";
import {ChatCleaner} from "./ChatCleaner";

const logger = tagLogger("BaseChatWorker");

/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
export abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData> implements ChatWorker {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    private readonly runner: DispatchRunner<A, AC, DATA>;

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
        state: ChatState<AC, DATA>,
        control: DispatchControl<A, AC, DATA>
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

    protected async getNextBatchSortIndex(chatDocumentPath: string, dispatchId?: string): Promise<number> {
        const messagesSoFar = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex", "desc")
            .limit(1)
            .get();
        return ((messagesSoFar.size > 0 && messagesSoFar.docs[0].data()?.inBatchSortIndex) || -1) + 1;
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
            state: ChatState<AC, DATA>,
            control: DispatchControl<A, AC, DATA>
        ) => Promise<void>
    ): Promise<void> {
        return this.runner.dispatchWithCheck(
            req,
            async (soFar, chatCommand, updateState) => {
                const command = isBoundChatCommand(chatCommand) ? chatCommand.command : chatCommand;
                const control: DispatchControl<A, AC, DATA> = {
                    updateChatState: updateState,
                    continueQueue: async (next: ChatCommand<A> | BoundChatCommand<A>) => {
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
