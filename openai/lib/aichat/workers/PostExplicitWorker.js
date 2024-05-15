"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostExplicitFactory = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiChatAction_1 = require("../data/OpenAiChatAction");
const WorkerFactory_1 = require("./WorkerFactory");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class PostExplicitWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    async doDispatch(actions, data, state, control) {
        const postExplicit = actions[0];
        if ((0, OpenAiChatAction_1.isPostExplicitAction)(postExplicit)) {
            firebase_ai_chat_core_1.logger.d("Posting explicit messages...");
            const threadId = state.config.assistantConfig.threadId;
            if (undefined === threadId) {
                firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            const messages = postExplicit.messages;
            let latestMessageId = undefined;
            for (const message of messages) {
                latestMessageId = await this.wrapper.postMessage(threadId, message);
            }
            if (undefined !== latestMessageId) {
                await this.updateConfig(control, state, () => ({ lastMessageId: latestMessageId }));
            }
            await this.continueQueue(control, actions.slice(1, actions.length));
        }
        else {
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unknown", true, "Expected explicit post action", JSON.stringify(postExplicit)));
        }
    }
}
class PostExplicitFactory extends WorkerFactory_1.WorkerFactory {
    isSupportedAction(action) {
        return (0, OpenAiChatAction_1.isPostExplicitAction)(action);
    }
    create() {
        return new PostExplicitWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
exports.PostExplicitFactory = PostExplicitFactory;
//# sourceMappingURL=PostExplicitWorker.js.map