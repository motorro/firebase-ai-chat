"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExplicitPostWorker = exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiChatAction_1 = require("../data/VertexAiChatAction");
const BaseVertexAiWorker_1 = require("./BaseVertexAiWorker");
class BasePostWorker extends BaseVertexAiWorker_1.BaseVertexAiWorker {
    isSupportedAction(action) {
        return "post" === action || (0, VertexAiChatAction_1.isPostExplicitAction)(action);
    }
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            firebase_ai_chat_core_1.logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Requested instructions not found"));
        }
        const response = await this.wrapper.postMessage(threadId, instructions, (await this.doPost(data, actions[0])), state.data);
        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);
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
        });
        await batch.commit();
        await control.updateChatState({
            data: response.data
        });
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
class PostWorker extends BasePostWorker {
    isSupportedAction(action) {
        return "post" === action;
    }
    async doGetMessages(data) {
        return (await this.getMessages(data.chatDocumentPath, data.dispatchId)).map((it) => it.text);
    }
}
exports.PostWorker = PostWorker;
class ExplicitPostWorker extends BasePostWorker {
    isSupportedAction(action) {
        return (0, VertexAiChatAction_1.isPostExplicitAction)(action);
    }
    async doGetMessages(_data, action) {
        return (0, VertexAiChatAction_1.isPostExplicitAction)(action) ? (action.messages || []) : [];
    }
}
exports.ExplicitPostWorker = ExplicitPostWorker;
//# sourceMappingURL=PostWorker.js.map