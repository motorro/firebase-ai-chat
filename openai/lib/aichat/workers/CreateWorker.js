"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class CreateWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "create" === action;
    }
    async doDispatch(command, state, control) {
        firebase_ai_chat_core_1.logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: command.commonData.chatDocumentPath
        });
        await this.updateConfig(control, state, () => ({ threadId: threadId }));
        await this.continueNextInQueue(control, command);
    }
}
exports.CreateWorker = CreateWorker;
//# sourceMappingURL=CreateWorker.js.map