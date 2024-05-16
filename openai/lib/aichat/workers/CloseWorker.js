"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseFactory = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const WorkerFactory_1 = require("./WorkerFactory");
class CloseWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
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
class CloseFactory extends WorkerFactory_1.WorkerFactory {
    isSupportedAction(action) {
        return "close" === action;
    }
    create() {
        return new CloseWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
exports.CloseFactory = CloseFactory;
//# sourceMappingURL=CloseWorker.js.map