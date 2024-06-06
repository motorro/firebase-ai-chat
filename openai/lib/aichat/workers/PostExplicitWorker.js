"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostExplicitWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiChatAction_1 = require("../data/OpenAiChatAction");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("PostExplicitWorker");
class PostExplicitWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return (0, OpenAiChatAction_1.isPostExplicitAction)(action);
    }
    async doDispatch(command, state, control) {
        const postExplicit = command.actionData[0];
        if ((0, OpenAiChatAction_1.isPostExplicitAction)(postExplicit)) {
            logger.d("Posting explicit messages...");
            const threadId = state.config.assistantConfig.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
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
            await this.continueNextInQueue(control, command);
        }
        else {
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unknown", true, "Expected explicit post action", JSON.stringify(postExplicit)));
        }
    }
}
exports.PostExplicitWorker = PostExplicitWorker;
//# sourceMappingURL=PostExplicitWorker.js.map