"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
class CloseWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    static isSupportedAction(action) {
        return "close" === action;
    }
    async doDispatch(command, state, control) {
        firebase_ai_chat_core_1.logger.d("Closing chat...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        await control.updateChatState({
            status: "complete"
        });
        await this.continueNextInQueue(control, command);
    }
}
exports.CloseWorker = CloseWorker;
//# sourceMappingURL=CloseWorker.js.map