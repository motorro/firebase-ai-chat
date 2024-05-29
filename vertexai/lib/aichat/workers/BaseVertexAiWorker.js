"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseVertexAiWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
class BaseVertexAiWorker extends firebase_ai_chat_core_1.BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions Tools dispatcher map
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    instructions) {
        super(firestore, scheduler);
        this.defaultDispatcher = (data) => Promise.resolve(data);
        this.wrapper = wrapper;
        this.instructions = instructions;
    }
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    isSupportedCommand(req) {
        return "engine" in req.data && "vertexai" === req.data.engine
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
    /**
     * Updates config
     * @param control Chat control
     * @param state Current state
     * @param update Builds config changes
     * @protected
     */
    async updateConfig(control, state, update) {
        const config = Object.assign(Object.assign({}, state.config), { assistantConfig: Object.assign(Object.assign({}, state.config.assistantConfig), (update(state.config.assistantConfig))) });
        await control.updateChatState({
            config: config
        });
    }
}
exports.BaseVertexAiWorker = BaseVertexAiWorker;
//# sourceMappingURL=BaseVertexAiWorker.js.map