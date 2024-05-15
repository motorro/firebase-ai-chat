"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFactory = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const WorkerFactory_1 = require("./WorkerFactory");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class CreateWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    async doDispatch(actions, data, state, control) {
        firebase_ai_chat_core_1.logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: data.chatDocumentPath
        });
        await this.updateConfig(control, state, (soFar) => ({ threadId: threadId }));
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
class CreateFactory extends WorkerFactory_1.WorkerFactory {
    isSupportedAction(action) {
        return "create" === action;
    }
    create() {
        return new CreateWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
exports.CreateFactory = CreateFactory;
//# sourceMappingURL=CreateWorker.js.map