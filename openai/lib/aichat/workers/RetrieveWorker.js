"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrieveWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const firebase_admin_1 = require("firebase-admin");
var FieldValue = firebase_admin_1.firestore.FieldValue;
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("RetrieveWorker");
class RetrieveWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "retrieve" === action;
    }
    async doDispatch(command, state, control) {
        logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messageCollectionRef = this.getMessageCollection(command.commonData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(command.commonData.chatDocumentPath, command.commonData.dispatchId);
        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach(([, message], index) => {
            var _a;
            let text;
            let data = null;
            let meta = ((_a = state.meta) === null || _a === void 0 ? void 0 : _a.aiMessageMeta) || null;
            if ((0, firebase_ai_chat_core_1.isStructuredMessage)(message)) {
                text = message.text;
                data = message.data || null;
                if (message.meta) {
                    if (null != meta) {
                        meta = Object.assign(Object.assign({}, meta), message.meta);
                    }
                    else {
                        meta = message.meta;
                    }
                }
            }
            else {
                text = String(message);
            }
            batch.set(messageCollectionRef.doc(), Object.assign({ userId: command.commonData.ownerId, dispatchId: command.commonData.dispatchId, author: "ai", text: text, data: data, inBatchSortIndex: latestInBatchId + index, createdAt: FieldValue.serverTimestamp(), meta: meta }, (state.sessionId ? { sessionId: state.sessionId } : {})));
        });
        await batch.commit();
        await this.updateConfig(control, state, () => ({ lastMessageId: newMessages.latestMessageId }));
        await this.continueNextInQueue(control, command);
    }
}
exports.RetrieveWorker = RetrieveWorker;
//# sourceMappingURL=RetrieveWorker.js.map