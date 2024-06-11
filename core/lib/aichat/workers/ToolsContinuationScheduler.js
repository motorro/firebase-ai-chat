"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsContinuationSchedulerImpl = exports.ToolsContinuationSchedulerFactoryImpl = void 0;
const ToolsDispatcher_1 = require("../ToolsDispatcher");
const firebase_admin_1 = require("firebase-admin");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const ChatError_1 = require("../data/ChatError");
var FieldValue = firebase_admin_1.firestore.FieldValue;
const logger = (0, logging_1.tagLogger)("ToolsContinuationScheduler");
class ToolsContinuationSchedulerFactoryImpl {
    constructor(firebase, scheduler, logData) {
        this.firebase = firebase;
        this.scheduler = scheduler;
        this.logData = logData;
    }
    create(queueName) {
        return new ToolsContinuationSchedulerImpl(queueName, this.firebase, this.scheduler, this.logData);
    }
}
exports.ToolsContinuationSchedulerFactoryImpl = ToolsContinuationSchedulerFactoryImpl;
/**
 * Continuation implementation
 */
class ToolsContinuationSchedulerImpl {
    constructor(queueName, db, scheduler, logData = false) {
        this.queueName = queueName;
        this.db = db;
        this.scheduler = scheduler;
        this.logData = logData;
    }
    async continue(command, response) {
        logger.d("Dispatching continuation command:", JSON.stringify(command), JSON.stringify(response));
        // eslint-disable-next-line max-len
        const chatDocument = this.db.doc(command.commonData.chatDocumentPath);
        // eslint-disable-next-line max-len
        const continuationDocument = chatDocument.collection(Collections_1.Collections.continuations).doc(command.continuation.continuationId);
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError_1.ChatError("not-found", true, "Continuation data not found"));
        }
        const toolCallDoc = toolCallsCollection.doc(command.continuation.tool.toolId);
        await this.db.runTransaction(async (tx) => {
            const toolCallData = (await tx.get(toolCallDoc)).data();
            if (undefined === toolCallData) {
                logger.w("Tool call not found");
                return Promise.reject(new ChatError_1.ChatError("not-found", true, "Inconsistent tool calls. Tool call not found"));
            }
            if (null !== toolCallData.call.response) {
                logger.w("Tool call already complete");
                return Promise.reject(new ChatError_1.ChatError("already-exists", true, "Inconsistent tool calls. Tool call already fulfilled"));
            }
            if ((0, ToolsDispatcher_1.isReducerSuccess)(response)) {
                const stateData = (await tx.get(chatDocument)).data();
                if (command.commonData.dispatchId === (stateData === null || stateData === void 0 ? void 0 : stateData.latestDispatchId)) {
                    if (this.logData) {
                        (0, logging_1.tagLogger)("DATA").d("Saving chat data: ", JSON.stringify(response.data));
                    }
                    tx.set(chatDocument, { data: response.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                }
                else {
                    logger.d("Document has dispatch another command. Data update cancelled");
                }
            }
            tx.set(toolCallDoc, Object.assign(Object.assign({}, toolCallData), { call: Object.assign(Object.assign({}, toolCallData.call), { response: response }) }));
            tx.set(continuationDocument, {
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
        });
        await this.scheduler.schedule(this.queueName, command);
    }
}
exports.ToolsContinuationSchedulerImpl = ToolsContinuationSchedulerImpl;
//# sourceMappingURL=ToolsContinuationScheduler.js.map