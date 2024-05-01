"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseOpenAiWorker_1 = require("./BaseOpenAiWorker");
class PostWorker extends BaseOpenAiWorker_1.BaseOpenAiWorker {
    isSupportedAction(action) {
        return "post" === action;
    }
    async doDispatch(action, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messages = await this.getMessages(data.chatDocumentPath, data.dispatchId);
        let latestMessageId = undefined;
        for (const message of messages) {
            latestMessageId = await this.wrapper.postMessage(threadId, message.text);
        }
        await control.updateChatState(Object.assign({}, (undefined != latestMessageId ? { lastMessageId: latestMessageId } : {})));
        await this.continueQueue(control, action.slice(1, action.length));
    }
}
exports.PostWorker = PostWorker;
//# sourceMappingURL=PostWorker.js.map