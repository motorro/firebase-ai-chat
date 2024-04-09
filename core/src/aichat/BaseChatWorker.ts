import {firestore} from "firebase-admin";
import {ChatCommandData} from "./data/ChatCommandData";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import {logger} from "../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;
import {AssistantConfig, ChatData, ChatState} from "./data/ChatState";
import {isPermanentError} from "./data/ChatError";
import {ChatCommand, TaskScheduler} from "./TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {Run, RunStatus} from "./data/Dispatch";
import {Meta} from "./data/Meta";

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData> {
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
        logger.d("Dispatching command: ", JSON.stringify(req.data));
        if (this.isSupportedCommand(req)) {
            await this.dispatchWithCheck(req, onQueueComplete, async (action, data, state) => {
                return await this.doDispatch(action, data, state);
            });
            return true;
        } else {
            logger.w("Unsupported command. Aborting...");
            return false;
        }
    }

    /**
     * Checks if command is supported
     * @param req Request to check
     * @protected
     */
    protected abstract isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<A>>

    /**
     * Dispatches action
     * @param action
     * @param data
     * @param state
     * @protected
     */
    protected abstract doDispatch(
        action: A,
        data: ChatCommandData,
        state: ChatState<AC, DATA>
    ): Promise<Partial<ChatState<AC, DATA>> | null>

    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @private
     */
    protected getMessageCollection(chatDocumentPath: string): CollectionReference<ChatMessage> {
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
    protected async dispatchWithCheck(
        req: Request<ChatCommand<A>>,
        onQueueComplete: ((chatDocumentPath: string, meta: Meta | null) => void | Promise<void>) | undefined,
        processAction: (
            action: A,
            data: ChatCommandData,
            state: ChatState<AC, DATA>
        ) => Promise<Partial<ChatState<AC, DATA>> | null>
    ): Promise<void> {
        const db = this.db;
        const command = req.data;
        const doc = this.db.doc(command.commonData.chatDocumentPath) as DocumentReference<ChatState<AC, DATA>>;
        const runDoc = doc.collection(Collections.dispatches)
            .doc(command.commonData.dispatchId).collection(Collections.runs)
            .doc(req.id) as DocumentReference<Run>;
        const action = command.actions[0];
        if (undefined === action) {
            logger.w("Empty command queue in command", JSON.stringify(command));
            return;
        }

        logger.d(`Dispatching action ${action} (0 of ${command.actions.length} for document: ${command.commonData.chatDocumentPath}`);
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

        let resultState: Partial<ChatState<AC, DATA>> | null;
        try {
            resultState = await processAction(action, command.commonData, stateToDispatch);
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

        async function updateWithCheck(runStatus: RunStatus, state: Partial<ChatState<AC, DATA>> | null): Promise<void> {
            logger.d("Finalizing task...");
            await db.runTransaction(async (tx) => {
                if (null !== state) {
                    const stateData = (await tx.get(doc)).data();
                    if (command.commonData.dispatchId === stateData?.latestDispatchId) {
                        tx.set(doc, state, {merge: true});
                    }
                }
                tx.set(runDoc, {status: runStatus}, {merge: true});
            });
            if (undefined !== onQueueComplete) {
                logger.d("Running queue complete handler...");
                try {
                    await onQueueComplete(command.commonData.chatDocumentPath, command.commonData.meta);
                } catch (e: unknown) {
                    logger.w("Error running complete handler", e);
                }
            }
        }
    }
}
