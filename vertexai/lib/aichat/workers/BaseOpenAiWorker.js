"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseOpenAiWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
class BaseOpenAiWorker extends firebase_ai_chat_core_1.BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers) {
        super(firestore, scheduler);
        this.defaultDispatcher = (data) => Promise.resolve(data);
        this.wrapper = wrapper;
        this.dispatchers = dispatchers;
    }
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    isSupportedCommand(req) {
        return "engine" in req.data && "openai" === req.data.engine
            && Array.isArray(req.data.actionData)
            && undefined !== req.data.actionData[0]
            && this.isSupportedAction(req.data.actionData[0]);
    }
    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param actions Action queue
     * @protected
     */
    async continueQueue(control, actions) {
        if (0 === actions.length) {
            firebase_ai_chat_core_1.logger.d("Queue complete");
            await control.completeQueue();
            return;
        }
        if ("switchToUserInput" === actions[0]) {
            await this.runSwitchToUser(control);
            await this.continueQueue(control, actions.slice(1, actions.length));
            return;
        }
        firebase_ai_chat_core_1.logger.d("Scheduling next in queue:", JSON.stringify(actions));
        await control.continueQueue(actions);
    }
    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @param control Chat control
     * @protected
     */
    async runSwitchToUser(control) {
        firebase_ai_chat_core_1.logger.d("Switching to user input");
        await control.updateChatState({
            status: "userInput"
        });
    }
}
exports.BaseOpenAiWorker = BaseOpenAiWorker;
//# sourceMappingURL=BaseOpenAiWorkerCommand.js.map