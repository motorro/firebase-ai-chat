"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolContinuationSchedulerImpl = void 0;
const ToolsDispatcher_1 = require("../ToolsDispatcher");
const firebase_admin_1 = require("firebase-admin");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const ChatError_1 = require("../data/ChatError");
var FieldValue = firebase_admin_1.firestore.FieldValue;
/**
 * Continuation implementation
 */
class ToolContinuationSchedulerImpl {
    constructor(queueName, db, scheduler) {
        this.queueName = queueName;
        this.db = db;
        this.scheduler = scheduler;
    }
    async continue(command, response) {
        logging_1.logger.d("Dispatching continuation command:", JSON.stringify(command), JSON.stringify(response));
        // eslint-disable-next-line max-len
        const continuationDocument = this.db.doc(command.commonData.chatDocumentPath).collection(Collections_1.Collections.continuations).doc(command.continuation.continuationId);
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logging_1.logger.w("Continuation data not found");
            return Promise.reject(new ChatError_1.ChatError("not-found", true, "Continuation data not found"));
        }
        const toolCallDoc = toolCallsCollection.doc(command.continuation.tool.toolId);
        await this.db.runTransaction(async (tx) => {
            const toolCallData = (await tx.get(toolCallDoc)).data();
            if (undefined === toolCallData) {
                logging_1.logger.w("Tool call not found");
                return Promise.reject(new ChatError_1.ChatError("not-found", true, "Inconsistent tool calls. Tool call not found"));
            }
            if (null !== toolCallData.call.response) {
                logging_1.logger.w("Tool call already complete");
                return Promise.reject(new ChatError_1.ChatError("already-exists", true, "Inconsistent tool calls. Tool call already fulfilled"));
            }
            tx.set(toolCallDoc, Object.assign(Object.assign({}, toolCallData), { call: Object.assign(Object.assign({}, toolCallData.call), { response: response }) }));
            if ((0, ToolsDispatcher_1.isDispatchSuccess)(response)) {
                tx.set(continuationDocument, { data: response.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            }
        });
        await this.scheduler.schedule(this.queueName, command);
    }
}
exports.ToolContinuationSchedulerImpl = ToolContinuationSchedulerImpl;
//# sourceMappingURL=ToolsContinuationScheduler.js.map