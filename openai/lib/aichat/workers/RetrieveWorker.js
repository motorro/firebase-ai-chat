"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrieveWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseOpenAiWorker_1 = require("./BaseOpenAiWorker");
const firebase_admin_1 = require("firebase-admin");
var FieldValue = firebase_admin_1.firestore.FieldValue;
class RetrieveWorker extends BaseOpenAiWorker_1.BaseOpenAiWorker {
    isSupportedAction(action) {
        return "retrieve" === action;
    }
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);
        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach((message, index) => {
            batch.set(messageCollectionRef.doc(), {
                userId: data.ownerId,
                dispatchId: data.dispatchId,
                author: "ai",
                text: message[1],
                inBatchSortIndex: latestInBatchId + index,
                createdAt: FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        await this.updateConfig(control, state, (soFar) => ({ lastMessageId: newMessages.latestMessageId }));
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
exports.RetrieveWorker = RetrieveWorker;
//# sourceMappingURL=RetrieveWorker.js.map