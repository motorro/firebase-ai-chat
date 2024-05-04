"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseVertexAiWorker_1 = require("./BaseVertexAiWorker");
class PostWorker extends BaseVertexAiWorker_1.BaseVertexAiWorker {
    isSupportedAction(action) {
        return "post" === action;
    }
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            firebase_ai_chat_core_1.logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Requested instructions not found"));
        }
        const messages = await this.getMessages(data.chatDocumentPath, data.dispatchId);
        const response = await this.wrapper.postMessage(threadId, instructions, messages.map((it) => it.text), state.data);
        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);
        let latestMessageId = undefined;
        const batch = this.db.batch();
        response.messages.forEach((message, index) => {
            batch.set(messageCollectionRef.doc(), {
                userId: data.ownerId,
                dispatchId: data.dispatchId,
                author: message.author,
                text: message.text,
                inBatchSortIndex: latestInBatchId + index,
                createdAt: message.createdAt
            });
            latestMessageId = message.id;
        });
        await batch.commit();
        await control.updateChatState(Object.assign(Object.assign({}, (undefined != latestMessageId ? { lastMessageId: latestMessageId } : {})), { data: response.data }));
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
exports.PostWorker = PostWorker;
//# sourceMappingURL=PostWorker.js.map