"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseChatWorker = void 0;
const firebase_admin_1 = require("firebase-admin");
const Collections_1 = require("./data/Collections");
const logging_1 = require("../logging");
var FieldValue = firebase_admin_1.firestore.FieldValue;
const ChatError_1 = require("./data/ChatError");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     */
    constructor(firestore, scheduler) {
        this.db = firestore;
        this.scheduler = scheduler;
    }
    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    async dispatch(req, onQueueComplete) {
        logging_1.logger.d("Dispatching command: ", JSON.stringify(req.data));
        if (this.isSupportedCommand(req)) {
            await this.dispatchWithCheck(req, onQueueComplete, async (action, data, state) => {
                return await this.doDispatch(action, data, state);
            });
            return true;
        }
        else {
            logging_1.logger.d("Command not supported by this worker. Aborting...");
            return false;
        }
    }
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @protected
     */
    getMessageCollection(chatDocumentPath) {
        return this.db
            .doc(chatDocumentPath)
            .collection(Collections_1.Collections.messages);
    }
    /**
     * Creates chat message query
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Collection query to get chat messages
     * @protected
     */
    getThreadMessageQuery(chatDocumentPath, dispatchId) {
        let query = this.getMessageCollection(chatDocumentPath);
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
    async getMessages(chatDocumentPath, dispatchId) {
        const messages = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex")
            .get();
        const result = [];
        messages.docs.forEach((doc) => {
            const data = doc.data();
            if (undefined !== data) {
                result.push(data);
            }
        });
        return result;
    }
    async getNextBatchSortIndex(chatDocumentPath, dispatchId) {
        var _a;
        const messagesSoFar = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex", "desc")
            .limit(1)
            .get();
        return ((messagesSoFar.size > 0 && ((_a = messagesSoFar.docs[0].data()) === null || _a === void 0 ? void 0 : _a.inBatchSortIndex)) || -1) + 1;
    }
    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    async dispatchWithCheck(req, onQueueComplete, processAction) {
        const db = this.db;
        const command = req.data;
        const doc = this.db.doc(command.commonData.chatDocumentPath);
        const runDoc = doc.collection(Collections_1.Collections.dispatches)
            .doc(command.commonData.dispatchId).collection(Collections_1.Collections.runs)
            .doc(req.id);
        const action = command.actions[0];
        if (undefined === action) {
            logging_1.logger.w("Empty command queue in command", JSON.stringify(command));
            return;
        }
        logging_1.logger.d(`Dispatching action ${action} (0 of ${command.actions.length} for document: ${command.commonData.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();
            if (undefined === state) {
                logging_1.logger.w("Chat not found. Aborting...");
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
            tx.set(runDoc, { status: "running", runAttempt: req.retryCount, createdAt: FieldValue.serverTimestamp() });
            return state;
        });
        if (undefined === stateToDispatch) {
            logging_1.logger.w("Aborting...");
            return;
        }
        let resultState;
        try {
            resultState = await processAction(action, command.commonData, stateToDispatch);
        }
        catch (e) {
            logging_1.logger.w("Error running dispatch", e);
            if ((0, ChatError_1.isPermanentError)(e)) {
                logging_1.logger.w("Permanent error. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            logging_1.logger.d(`Current retry count attempt: ${retryCount}, maximum retry count: ${maxRetries}`);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logging_1.logger.w("Maximum retry count reached. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            logging_1.logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateWithCheck("waitingForRetry", null);
            return Promise.reject(e);
        }
        await updateWithCheck("complete", resultState);
        if (command.actions.length > 1) {
            logging_1.logger.d("Dispatching next command...");
            await this.scheduler.schedule(req.queueName, Object.assign(Object.assign({}, command), { actions: command.actions.slice(1) }));
        }
        else {
            logging_1.logger.d("Command queue complete");
        }
        async function updateWithCheck(runStatus, state) {
            logging_1.logger.d("Finalizing task...");
            await db.runTransaction(async (tx) => {
                if (null !== state) {
                    const stateData = (await tx.get(doc)).data();
                    if (command.commonData.dispatchId === (stateData === null || stateData === void 0 ? void 0 : stateData.latestDispatchId)) {
                        tx.set(doc, Object.assign(Object.assign({}, state), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
                    }
                }
                tx.set(runDoc, { status: runStatus }, { merge: true });
            });
            if (undefined !== onQueueComplete) {
                logging_1.logger.d("Running queue complete handler...");
                try {
                    await onQueueComplete(command.commonData.chatDocumentPath, command.commonData.meta);
                }
                catch (e) {
                    logging_1.logger.w("Error running complete handler", e);
                }
            }
        }
    }
}
exports.BaseChatWorker = BaseChatWorker;
//# sourceMappingURL=BaseChatWorker.js.map