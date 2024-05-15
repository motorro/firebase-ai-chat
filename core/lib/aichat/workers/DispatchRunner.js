"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchRunner = void 0;
const ChatCommand_1 = require("../data/ChatCommand");
const firebase_admin_1 = require("firebase-admin");
const Collections_1 = require("../data/Collections");
const logging_1 = require("../../logging");
const ChatError_1 = require("../data/ChatError");
var FieldValue = firebase_admin_1.firestore.FieldValue;
/**
 * Runs task locking on current dispatch and run
 */
class DispatchRunner {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheculer
     */
    constructor(firestore, scheduler) {
        this.db = firestore;
        this.scheduler = scheduler;
    }
    async dispatchWithCheck(req, run) {
        const db = this.db;
        const command = (0, ChatCommand_1.isBoundChatCommand)(req.data) ? req.data.command : req.data;
        const doc = this.db.doc(command.commonData.chatDocumentPath);
        const runDoc = doc.collection(Collections_1.Collections.dispatches)
            .doc(command.commonData.dispatchId)
            .collection(Collections_1.Collections.runs)
            .doc(req.id);
        logging_1.logger.d(`Dispatching command for document: ${command.commonData.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();
            if (undefined === state) {
                logging_1.logger.w("Document not found. Aborting...");
                return undefined;
            }
            if (command.commonData.dispatchId !== state.latestDispatchId) {
                logging_1.logger.w("Another command is dispatched. Aborting...");
                return undefined;
            }
            const run = await tx.get(runDoc);
            if (run.exists) {
                const runData = run.data();
                if ("complete" === (runData === null || runData === void 0 ? void 0 : runData.status)) {
                    logging_1.logger.w("Already done. Aborting...");
                    return undefined;
                }
                if ("running" === (runData === null || runData === void 0 ? void 0 : runData.status)) {
                    logging_1.logger.w("Already running. Aborting...");
                    return undefined;
                }
            }
            tx.set(runDoc, { status: "running", runAttempt: req.retryCount, createdAt: FieldValue.serverTimestamp() }, {});
            return state;
        });
        if (undefined === stateToDispatch) {
            logging_1.logger.w("Aborting...");
            return;
        }
        const updateState = async (state) => {
            return await this.db.runTransaction(async (tx) => {
                const stateData = (await tx.get(doc)).data();
                if (command.commonData.dispatchId === (stateData === null || stateData === void 0 ? void 0 : stateData.latestDispatchId)) {
                    logging_1.logger.d(`Updating document state of ${doc.path}:`, JSON.stringify(state));
                    tx.set(doc, Object.assign(Object.assign({}, state), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
                    return true;
                }
                else {
                    logging_1.logger.d("Document has dispatch another command. Data update cancelled");
                    return false;
                }
            });
        };
        const fail = async (e) => {
            await updateState({
                status: "failed",
                lastError: String(e)
            });
            await updateRun("complete");
        };
        try {
            await run(stateToDispatch, command, updateState);
            await updateRun("complete");
        }
        catch (e) {
            logging_1.logger.w("Error running dispatch", e);
            if ((0, ChatError_1.isPermanentError)(e)) {
                logging_1.logger.w("Permanent error. Failing chat...");
                await fail(e);
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            logging_1.logger.d(`Current retry count attempt: ${retryCount}, maximum retry count: ${maxRetries}`);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logging_1.logger.w("Maximum retry count reached. Failing chat...");
                await fail(e);
                return;
            }
            logging_1.logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateRun("waitingForRetry");
            return Promise.reject(e);
        }
        async function updateRun(status) {
            logging_1.logger.d("Updating run to:", status);
            await runDoc.set({ status: status }, { merge: true });
        }
    }
}
exports.DispatchRunner = DispatchRunner;
//# sourceMappingURL=DispatchRunner.js.map