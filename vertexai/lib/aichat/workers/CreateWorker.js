"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseVertexAiWorker_1 = require("./BaseVertexAiWorker");
class CreateWorker extends BaseVertexAiWorker_1.BaseVertexAiWorker {
    isSupportedAction(action) {
        return "create" === action;
    }
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: data.chatDocumentPath
        });
        await this.updateConfig(control, state, (soFar) => ({ threadId: threadId }));
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
exports.CreateWorker = CreateWorker;
//# sourceMappingURL=CreateWorker.js.map