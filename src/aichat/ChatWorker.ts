import {firestore} from "firebase-admin";
import {AiWrapper} from "./AiWrapper";
import {ToolsDispatcher} from "./ToolsDispatcher";
import {ChatCommand} from "./data/ChatCommand";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import {logger} from "../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;
import {ChatData, ChatState} from "./data/ChatState";
import {ChatStatus} from "./data/ChatStatus";
import {ChatError, isPermanentError} from "./data/ChatError";
import {TaskScheduler} from "./TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import {FunctionsErrorCode} from "firebase-functions/lib/common/providers/https";
import {Request} from "firebase-functions/lib/common/providers/tasks";

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class ChatWorker {
    private readonly db: FirebaseFirestore.Firestore;

    private readonly wrapper: AiWrapper;
    private readonly scheduler: TaskScheduler;
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>; // eslint-disable-line  @typescript-eslint/no-explicit-any

    private readonly defaultDispatcher: ToolsDispatcher<ChatData> = (data) => Promise.resolve({data: data});

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>> // eslint-disable-line  @typescript-eslint/no-explicit-any
    ) {
        this.db = firestore;
        this.wrapper = wrapper;
        this.scheduler = scheduler;
        this.dispatchers = dispatchers;
    }

    /**
     * Dispatches command
     * @param req Dispatch request
     */
    async dispatch(req: Request<ChatCommand>): Promise<void> {
        const command = req.data;
        try {
            switch (command.type) {
                case "create":
                    return await this.runCreateThread(command);
                case "post":
                    return await this.runPostMessages(command);
                case "run":
                    return await this.runRun(command);
                case "retrieve":
                    return await this.runRetrieve(command);
                case "close":
                    return await this.runClose(command);
            }
        } catch (e: unknown) {
            logger.w("Error running command", e);
            if (isChatWorkerError(e)) {
                logger.w("Possible duplicate run");
                return Promise.resolve();
            }
            if (isPermanentError(e)) {
                logger.w("Permanent error. Failing chat...");
                return await this.updateWithCheck(command, () => true, () => ({
                    status: "failed"
                }));
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logger.w("Maximum retry count reached. Failing chat...");
                return await this.updateWithCheck(command, () => true, () => ({
                    status: "failed"
                }));
            }
            logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            return Promise.reject(e);
        }
    }

    /**
     * Creates thread
     * @param command Command data
     * @private
     */
    private async runCreateThread(command: ChatCommand): Promise<void> {
        logger.d(`Creating thread. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "creating" === status, async () => {
            const threadId = await this.wrapper.createThread({
                chat: command.chatDocumentPath
            });
            await this.updateWithCheck(command, (status) => "creating" === status, (state) => ({
                status: "created",
                config: {
                    ...state.config,
                    threadId: threadId
                }
            }));
        });
    }

    /**
     * Posts user messages of current dispatch
     * @param command Command data
     * @private
     */
    private async runPostMessages(command: ChatCommand): Promise<void> {
        logger.d(`Posting message. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "posting" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }

            const messageCollectionRef = this.getMessageCollection(command.chatDocumentPath);
            const messages = await messageCollectionRef
                .where("dispatchId", "==", command.dispatchId)
                .orderBy("inBatchSortIndex")
                .get();

            let latestMessageId: string | undefined = undefined;
            for (const message of messages.docs) {
                const data = message.data();
                if (undefined !== data) {
                    latestMessageId = await this.wrapper.postMessage(threadId, data.text);
                }
            }

            await this.updateWithCheck(command, (status) => "posting" === status, () => ({
                status: "processing",
                ...(undefined != latestMessageId ? {lastMessageId: latestMessageId} : {})
            }));
            const runCommand: ChatCommand = {
                ...command,
                type: "run"
            };
            await this.scheduler.schedule(state.config.workerName, runCommand);
        });
    }

    /**
     * Runs assistant
     * @param command Command data
     * @private
     */
    private async runRun(command: ChatCommand): Promise<void> {
        logger.d(`Running assistant. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "processing" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
            const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);

            await this.updateWithCheck(command, (status) => "processing" === status, () => ({
                status: "gettingMessages",
                data: newData
            }));
            const retrieveCommand: ChatCommand = {
                ...command,
                type: "retrieve"
            };
            await this.scheduler.schedule(state.config.workerName, retrieveCommand);
        });
    }

    /**
     * Retrieves new messages
     * @param command Command data
     * @private
     */
    private async runRetrieve(command: ChatCommand): Promise<void> {
        logger.d(`Retrieving messages. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "gettingMessages" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }

            const messageCollectionRef = this.getMessageCollection(command.chatDocumentPath);
            const messagesSoFar = await messageCollectionRef
                .where("dispatchId", "==", command.dispatchId)
                .orderBy("inBatchSortIndex", "desc")
                .limit(1)
                .get();
            const latestInBatchId = ((messagesSoFar.size > 0 && messagesSoFar.docs[0].data()?.inBatchSortIndex) || -1) + 1;

            const newMessages = await this.wrapper.getMessages(threadId, state.lastMessageId);
            const batch = this.db.batch();
            newMessages.messages.forEach(([id, message], index) => {
                batch.set(
                    messageCollectionRef.doc(`ai_${id}`),
                    {
                        userId: command.ownerId,
                        dispatchId: command.dispatchId,
                        author: "ai",
                        text: message,
                        inBatchSortIndex: latestInBatchId + index,
                        createdAt: FieldValue.serverTimestamp()
                    }
                );
            });
            await batch.commit();
            await this.updateWithCheck(command, (status) => "gettingMessages" === status, () => ({
                status: "userInput",
                lastMessageId: newMessages.latestMessageId
            }));
        });
    }

    /**
     * Closes chat
     * @param command Command data
     * @private
     */
    private async runClose(command: ChatCommand): Promise<void> {
        logger.d(`Closing chat. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "closing" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            await this.wrapper.deleteThread(threadId);
            await this.updateWithCheck(command, (status) => "posting" === status, () => ({
                status: "complete"
            }));
        });
    }

    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @private
     */
    private getMessageCollection(chatDocumentPath: string): CollectionReference<ChatMessage> {
        return this.db
            .doc(chatDocumentPath)
            .collection(Collections.messages) as CollectionReference<ChatMessage>;
    }

    private async checkState(
        state: ChatState<ChatData> | undefined,
        command: ChatCommand,
        checkStatus: (currentStatus: ChatStatus) => boolean
    ): Promise<ChatState<ChatData>> {
        if (undefined === state) {
            logger.w("Chat not found: ", command.chatDocumentPath);
            return Promise.reject(
                new ChatWorkerError("not-found", "Chat not found")
            );
        }
        if (false === checkStatus(state.status) || command.dispatchId !== state.dispatchId) {
            logger.w("Chat is not in the expected state/dispatch");
            return Promise.reject(
                new ChatWorkerError("failed-precondition", "Chat status conflict")
            );
        }
        return state;
    }

    private async withCheckedState(
        command: ChatCommand,
        checkStatus: (currentStatus: ChatStatus) => boolean,
        block: (state: ChatState<ChatData>) => Promise<void>
    ): Promise<void> {
        logger.d("Getting chat state: ", command.chatDocumentPath);
        const doc = this.db.doc(command.chatDocumentPath) as DocumentReference<ChatState<ChatData>>;
        const state = (await doc.get()).data();
        return await block(await this.checkState(state, command, checkStatus));
    }

    private async updateWithCheck(
        command: ChatCommand,
        checkStatus: (currentStatus: ChatStatus) => boolean,
        block: (state: ChatState<ChatData>) => Partial<ChatState<ChatData>>
    ): Promise<void> {
        logger.d("Updating chat state: ", command.chatDocumentPath);
        return await this.db.runTransaction(async (tx) => {
            const doc = this.db.doc(command.chatDocumentPath) as DocumentReference<ChatState<ChatData>>;
            const state = (await tx.get(doc)).data();
            tx.set(
                doc,
                {...block(await this.checkState(state, command, checkStatus)), updatedAt: FieldValue.serverTimestamp()},
                {merge: true}
            );
        });
    }
}

/**
 * Internal error for flow alteration
 */
class ChatWorkerError extends ChatError {
    readonly isDispatchError = true;

    constructor(code: FunctionsErrorCode, message: string, details?: unknown) {
        super(code, true, message, details);
    }
}

/**
 * Checks if something is ChatWorkerError
 * @param something Some object
 * @return true if something is a ChatWorkerError
 */
function isChatWorkerError(something: unknown): something is ChatWorkerError {
    return "object" === typeof something && null != something && "isDispatchError" in something && true === something.isDispatchError;
}
