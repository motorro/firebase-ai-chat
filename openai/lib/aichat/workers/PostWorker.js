"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class PostWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "post" === action;
    }
    async doDispatch(command, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messages = await this.getMessages(command.commonData.chatDocumentPath, command.commonData.dispatchId);
        let latestMessageId = undefined;
        for (const message of messages) {
            latestMessageId = await this.wrapper.postMessage(threadId, message.text);
        }
        if (undefined !== latestMessageId) {
            await this.updateConfig(control, state, () => ({ lastMessageId: latestMessageId }));
        }
        await this.continueNextInQueue(control, command);
    }
}
exports.PostWorker = PostWorker;
//# sourceMappingURL=PostWorker.js.map