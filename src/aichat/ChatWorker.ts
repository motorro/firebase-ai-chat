import {firestore} from "firebase-admin";
import {AiWrapper} from "./AiWrapper";
import {ToolsDispatcher} from "./ToolsDispatcher";
import {ChatCommandData, ChatCommandQueue, ChatCommandType} from "./data/ChatCommandQueue";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import {logger} from "../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;
import {ChatData, ChatState} from "./data/ChatState";
import {ChatError, isPermanentError} from "./data/ChatError";
import {TaskScheduler} from "./TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {Run, RunStatus} from "./data/Dispatch";
import {Meta} from "./data/Meta";

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
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>
    ) {
        this.db = firestore;
        this.wrapper = wrapper;
        this.scheduler = scheduler;
        this.dispatchers = dispatchers;
    }

    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    async dispatch(
        req: Request<ChatCommandQueue>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<void> {
        await this.dispatchWithCheck(req, onQueueComplete, async (command, data, state) => {
            switch (command) {
                case "create":
                    return await this.runCreateThread(data, state);
                case "post":
                    return await this.runPostMessages(data, state);
                case "run":
                    return await this.runRun(state);
                case "retrieve":
                    return await this.runRetrieve(data, state);
                case "switchToUserInput":
                    return await this.runSwitchToUser();
                case "close":
                    return await this.runClose(state);
            }
        });
    }

    /**
     * Creates thread
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runCreateThread(commandData: ChatCommandData, state: ChatState<ChatData>): Promise<Partial<ChatState<ChatData>>> {
        logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: commandData.chatDocumentPath
        });
        return {
            config: {
                ...state.config,
                threadId: threadId
            }
        };
    }

    /**
     * Posts user messages of current dispatch
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runPostMessages(commandData: ChatCommandData, state: ChatState<ChatData>): Promise<Partial<ChatState<ChatData>>> {
        logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messageCollectionRef = this.getMessageCollection(commandData.chatDocumentPath);
        const messages = await messageCollectionRef
            .where("dispatchId", "==", commandData.dispatchId)
            .orderBy("inBatchSortIndex")
            .get();

        let latestMessageId: string | undefined = undefined;
        for (const message of messages.docs) {
            const data = message.data();
            if (undefined !== data) {
                latestMessageId = await this.wrapper.postMessage(threadId, data.text);
            }
        }

        return {
            ...(undefined != latestMessageId ? {lastMessageId: latestMessageId} : {})
        };
    }

    /**
     * Runs assistant
     * @param state Chat state
     * @private
     */
    private async runRun(state: ChatState<ChatData>): Promise<Partial<ChatState<ChatData>>> {
        logger.d("Running assistant...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);

        return {
            data: newData
        };
    }

    /**
     * Retrieves new messages
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runRetrieve(commandData: ChatCommandData, state: ChatState<ChatData>): Promise<Partial<ChatState<ChatData>>> {
        logger.d("Retrieving messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messageCollectionRef = this.getMessageCollection(commandData.chatDocumentPath);
        const messagesSoFar = await messageCollectionRef
            .where("dispatchId", "==", commandData.dispatchId)
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
                    userId: commandData.ownerId,
                    dispatchId: commandData.dispatchId,
                    author: "ai",
                    text: message,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp()
                }
            );
        });
        await batch.commit();
        return {
            lastMessageId: newMessages.latestMessageId
        };
    }

    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @private
     */
    private async runSwitchToUser(): Promise<Partial<ChatState<ChatData>>> {
        return {
            status: "userInput"
        };
    }

    /**
     * Closes chat
     * @param state Chat state
     * @private
     */
    private async runClose(state: ChatState<ChatData>): Promise<Partial<ChatState<ChatData>>> {
        logger.d("Closing chat...");
        const threadId = state.config.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        return {
            status: "complete"
        };
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

    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    private async dispatchWithCheck(
        req: Request<ChatCommandQueue>,
        onQueueComplete: ((chatDocumentPath: string, meta: Meta | null) => void | Promise<void>) | undefined,
        processAction: (
            command: ChatCommandType,
            data: ChatCommandData,
            state: ChatState<ChatData>
        ) => Promise<Partial<ChatState<ChatData>> | null>
    ): Promise<void> {
        const db = this.db;
        const command = req.data;
        const doc = this.db.doc(command.chatDocumentPath) as DocumentReference<ChatState<ChatData>>;
        const runDoc = doc.collection(Collections.dispatches)
            .doc(command.dispatchId).collection(Collections.runs)
            .doc(req.id) as DocumentReference<Run>;
        const action = command.actions[0];
        if (undefined === action) {
            logger.w("Empty command queue in command", JSON.stringify(command));
            return;
        }

        logger.d(`Dispatching action ${action} (0 of ${command.actions.length} for document: ${command.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();

            if (undefined === state) {
                logger.w("Chat not found. Aborting...");
                return undefined;
            }
            if (command.dispatchId !== state.latestDispatchId) {
                logger.w("Another command is dispatched. Aborting...");
                return undefined;
            }

            const run = await tx.get(runDoc);
            if (run.exists) {
                const runData = run.data();
                if ("complete" === runData?.status) {
                    logger.w("Already done. Aborting...");
                    return undefined;
                }
                if ("running" === runData?.status) {
                    logger.w("Already running. Aborting...");
                    return undefined;
                }
            }
            tx.set(runDoc, {status: "running", runAttempt: req.retryCount, createdAt: FieldValue.serverTimestamp()});
            return state;
        });

        if (undefined === stateToDispatch) {
            logger.w("Aborting...");
            return;
        }

        let resultState: Partial<ChatState<ChatData>> | null;
        try {
            resultState = await processAction(action, command, stateToDispatch);
        } catch (e) {
            logger.w("Error running dispatch", e);
            if (isPermanentError(e)) {
                logger.w("Permanent error. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            logger.d(`Current retry count attempt: ${retryCount}, maximum retry count: ${maxRetries}`);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logger.w("Maximum retry count reached. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateWithCheck("waitingForRetry", null);
            return Promise.reject(e);
        }

        await updateWithCheck("complete", resultState);

        if (command.actions.length > 1) {
            logger.d("Dispatching next command...");
            await this.scheduler.schedule(req.queueName, {...command, actions: command.actions.slice(1)});
        } else {
            logger.d("Command queue complete");
        }

        async function updateWithCheck(runStatus: RunStatus, state: Partial<ChatState<ChatData>> | null): Promise<void> {
            logger.d("Finalizing task...");
            await db.runTransaction(async (tx) => {
                if (null !== state) {
                    const stateData = (await tx.get(doc)).data();
                    if (command.dispatchId === stateData?.latestDispatchId) {
                        tx.set(doc, state, {merge: true});
                    }
                }
                tx.set(runDoc, {status: runStatus}, {merge: true});
            });
            if (undefined !== onQueueComplete) {
                logger.d("Running queue complete handler...");
                try {
                    await onQueueComplete(command.chatDocumentPath, command.meta);
                } catch (e: unknown) {
                    logger.w("Error running complete handler", e);
                }
            }
        }
    }
}
