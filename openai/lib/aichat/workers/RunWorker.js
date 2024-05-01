"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseOpenAiWorker_1 = require("./BaseOpenAiWorker");
class RunWorker extends BaseOpenAiWorker_1.BaseOpenAiWorker {
    isSupportedAction(action) {
        return "run" === action;
    }
    async doDispatch(action, _data, state, control) {
        firebase_ai_chat_core_1.logger.d("Running assistant...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const dispatcher = this.dispatchers[state.config.assistantConfig.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatcher);
        await control.updateChatState({
            data: newData
        });
        await this.continueQueue(control, action.slice(1, action.length));
    }
}
exports.RunWorker = RunWorker;
//# sourceMappingURL=RunWorker.js.map