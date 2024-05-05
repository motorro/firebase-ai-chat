import {firestore} from "firebase-admin";
import {ChatCommandData} from "../data/ChatCommandData";
import {Collections} from "../data/Collections";
import {ChatMessage} from "../data/ChatMessage";
import {logger} from "../../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {isPermanentError} from "../data/ChatError";
import {TaskScheduler} from "../TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {Run, RunStatus} from "../data/Dispatch";
import {Meta} from "../data/Meta";
import Query = firestore.Query;
import {ChatCommand} from "../data/ChatCommand";
import {ChatWorker, DispatchControl} from "./ChatWorker";

/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
export abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData> implements ChatWorker {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     */
    protected constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler) {
        this.db = firestore;
        this.scheduler = scheduler;
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
            await this.dispatchWithCheck(req, onQueueComplete, async (action, data, state, control) => {
                return await this.doDispatch(action, data, state, control);
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
     * @param action Action to perform
     * @param data Command data
     * @param state Current chat state
     * @param control Continuation control
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected abstract doDispatch(
        action: A,
        data: ChatCommandData,
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
            action: A,
            data: ChatCommandData,
            state: ChatState<AC, DATA>,
            control: DispatchControl<A, AC, DATA>
        ) => Promise<void>
    ): Promise<void> {
        const db = this.db;
        const command = req.data;
        const doc = this.db.doc(command.commonData.chatDocumentPath) as DocumentReference<ChatState<AC, DATA>>;
        const runDoc = doc.collection(Collections.dispatches)
            .doc(command.commonData.dispatchId)
            .collection(Collections.runs)
            .doc(req.id) as DocumentReference<Run>;
        const action = command.actionData;
        if (undefined === action) {
            logger.w("Empty command queue in command", JSON.stringify(command));
            return;
        }

        logger.d(`Dispatching action ${action} for document: ${command.commonData.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();

            if (undefined === state) {
                logger.w("Chat not found. Aborting...");
                return undefined;
            }
            if (command.commonData.dispatchId !== state.latestDispatchId) {
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

        const updateChatState = async (state: Partial<ChatState<AC, DATA>>) => {
            return await this.db.runTransaction(async (tx) => {
                const stateData = (await tx.get(doc)).data();
                if (command.commonData.dispatchId === stateData?.latestDispatchId) {
                    logger.d(`Updating chat state of ${doc.path}:`, JSON.stringify(state));
                    tx.set(doc, {...state, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
                    return true;
                } else {
                    logger.d("Chat has dispatch another command. Data update cancelled");
                    return false;
                }
            });
        };
        const getContinuation = (action: A) => {
            return {...command, actionData: action};
        };
        const control: DispatchControl<A, AC, DATA> = {
            updateChatState: updateChatState,
            getContinuation: getContinuation,
            continueQueue: async (action: A) => {
                logger.d("Scheduling next step: ", JSON.stringify(action));
                await this.scheduler.schedule(req.queueName, getContinuation(action));
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

        try {
            await processAction(action, command.commonData, stateToDispatch, control);
        } catch (e) {
            logger.w("Error running dispatch", e);
            if (isPermanentError(e)) {
                logger.w("Permanent error. Failing chat...");
                await updateChatState({
                    status: "failed",
                    lastError: String(e)
                });
                await updateRun("complete");
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            logger.d(`Current retry count attempt: ${retryCount}, maximum retry count: ${maxRetries}`);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logger.w("Maximum retry count reached. Failing chat...");
                await updateChatState({
                    status: "failed",
                    lastError: String(e)
                });
                await updateRun("complete");
                return;
            }
            logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateRun("waitingForRetry");
            return Promise.reject(e);
        }

        await updateRun("complete");

        async function updateRun(status: RunStatus) {
            logger.d("Updating run to:", status);
            await runDoc.set({status: status}, {merge: true});
        }
    }
}
