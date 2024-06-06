"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("CreateWorker");
class CreateWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "create" === action;
    }
    async doDispatch(command, state, control) {
        if (state.config.assistantConfig.threadId) {
            logger.d("Already has a thread:", state.config.assistantConfig.threadId);
        }
        else {
            logger.d("Creating thread...");
            const threadId = await this.wrapper.createThread({
                chat: command.commonData.chatDocumentPath
            });
            logger.d("Thread created:", threadId);
            await this.updateConfig(control, state, () => ({ threadId: threadId }));
        }
        await this.continueNextInQueue(control, command);
    }
}
exports.CreateWorker = CreateWorker;
//# sourceMappingURL=CreateWorker.js.map