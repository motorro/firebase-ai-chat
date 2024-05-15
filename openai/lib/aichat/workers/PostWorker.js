"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostFactory = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const WorkerFactory_1 = require("./WorkerFactory");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class PostWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messages = await this.getMessages(data.chatDocumentPath, data.dispatchId);
        let latestMessageId = undefined;
        for (const message of messages) {
            latestMessageId = await this.wrapper.postMessage(threadId, message.text);
        }
        if (undefined !== latestMessageId) {
            await this.updateConfig(control, state, (soFar) => ({ lastMessageId: latestMessageId }));
        }
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
class PostFactory extends WorkerFactory_1.WorkerFactory {
    isSupportedAction(action) {
        return "post" === action;
    }
    create() {
        return new PostWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
exports.PostFactory = PostFactory;
//# sourceMappingURL=PostWorker.js.map