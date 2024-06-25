import {Request} from "firebase-functions/lib/common/providers/tasks";
import {BoundChatCommand, ChatCommand, isBoundChatCommand} from "../data/ChatCommand";
import {Run, RunStatus} from "../data/Dispatch";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import {TaskScheduler} from "../TaskScheduler";
import {Collections} from "../data/Collections";
import {tagLogger} from "../../logging";
import {isPermanentError} from "../data/ChatError";
import FieldValue = firestore.FieldValue;
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {ChatCleaner} from "./ChatCleaner";
import {ChatMeta} from "../data/Meta";

const logger = tagLogger("DispatchRunner");

/**
 * Runs task locking on current dispatch and run
 */
export class DispatchRunner<A, AC extends AssistantConfig, DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    protected readonly cleaner: ChatCleaner;
    protected readonly logData: boolean;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean) {
        this.db = firestore;
        this.scheduler = scheduler;
        this.cleaner = cleaner;
        this.logData = logData;
    }

    async dispatchWithCheck(
        req: Request<ChatCommand<A>> | Request<BoundChatCommand<A>>,
        run: (
            soFar: ChatState<AC, DATA, CM>,
            command: ChatCommand<A> | BoundChatCommand<A>,
            updateState: (update: Partial<ChatState<AssistantConfig, DATA, CM>>) => Promise<ChatState<AssistantConfig, DATA, CM>>
        ) => Promise<void>,
    ): Promise<void> {
        const db = this.db;
        const command = isBoundChatCommand(req.data) ? req.data.command : req.data;
        const doc = this.db.doc(command.commonData.chatDocumentPath) as DocumentReference<ChatState<AC, DATA, CM>>;
        const runDoc = doc.collection(Collections.dispatches)
            .doc(command.commonData.dispatchId)
            .collection(Collections.runs)
            .doc(req.id) as DocumentReference<Run>;

        logger.d(`Dispatching command for document: ${command.commonData.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();

            if (undefined === state) {
                logger.w("Document not found. Aborting...");
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
            tx.set(runDoc, {status: "running", runAttempt: req.retryCount, createdAt: FieldValue.serverTimestamp()}, {});
            return state;
        });

        if (undefined === stateToDispatch) {
            logger.w("Aborting...");
            return;
        }

        const updateState = async (state: Partial<ChatState<AssistantConfig, DATA, CM>>) => {
            await this.db.runTransaction(async (tx) => {
                const stateData = (await tx.get(doc)).data();
                if (command.commonData.dispatchId === stateData?.latestDispatchId) {
                    if (this.logData) {
                        tagLogger("DATA").d(`Updating document state of ${doc.path}:`, JSON.stringify(state));
                    }
                    tx.set(doc, {...state, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
                } else {
                    logger.d("Document has dispatch another command. Data update cancelled");
                }
            });
            return <ChatState<AssistantConfig, DATA, CM>>(await doc.get()).data();
        };

        const fail = async (e: unknown)=> {
            await updateState({
                status: "failed",
                lastError: String(e)
            });
            await this.cleaner.cleanup(command.commonData.chatDocumentPath);
            await updateRun("complete");
        };

        try {
            await run(stateToDispatch, command, updateState);
            await updateRun("complete");
        } catch (e) {
            logger.w("Error running dispatch", e);
            if (isPermanentError(e)) {
                logger.w("Permanent error. Failing chat...");
                await fail(e);
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            logger.d(`Current retry count attempt: ${retryCount}, maximum retry count: ${maxRetries}`);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logger.w("Maximum retry count reached. Failing chat...");
                await fail(e);
                return;
            }
            logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateRun("waitingForRetry");
            return Promise.reject(e);
        }

        async function updateRun(status: RunStatus) {
            logger.d("Updating run to:", status);
            await runDoc.set({status: status}, {merge: true});
        }
    }
}
