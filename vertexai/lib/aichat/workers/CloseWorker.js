"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseVertexAiWorker_1 = require("./BaseVertexAiWorker");
class CloseWorker extends BaseVertexAiWorker_1.BaseVertexAiWorker {
    isSupportedAction(action) {
        return "close" === action;
    }
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Closing chat...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        await control.updateChatState({
            status: "complete"
        });
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
exports.CloseWorker = CloseWorker;
//# sourceMappingURL=CloseWorker.js.map