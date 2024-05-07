"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const BaseOpenAiWorker_1 = require("./BaseOpenAiWorker");
class RunWorker extends BaseOpenAiWorker_1.BaseOpenAiWorker {
    isSupportedAction(action) {
        return "run" === action;
    }
    async doDispatch(actions, _data, state, control) {
        firebase_ai_chat_core_1.logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        firebase_ai_chat_core_1.logger.d("Selecting dispatcher:", state.config.assistantConfig.dispatcherId);
        let dispatcher = this.dispatchers[state.config.assistantConfig.dispatcherId];
        if (undefined === dispatcher) {
            firebase_ai_chat_core_1.logger.w("Dispatcher not found:", state.config.assistantConfig.dispatcherId);
            dispatcher = this.defaultDispatcher;
        }
        const newData = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatcher);
        await control.updateChatState({
            data: newData
        });
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
exports.RunWorker = RunWorker;
//# sourceMappingURL=RunWorker.js.map