"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiQueueWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("VertexAiQueueWorker");
class VertexAiQueueWorker extends firebase_ai_chat_core_1.BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(firestore, scheduler, wrapper) {
        super(firestore, scheduler);
        this.wrapper = wrapper;
    }
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    isSupportedCommand(req) {
        // Handled statically
        return true;
    }
    async continueNextInQueue(control, currentCommand) {
        await this.continueQueue(control, Object.assign(Object.assign({}, currentCommand), { actionData: currentCommand.actionData.slice(1, currentCommand.actionData.length) }));
    }
    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param command Next command
     * @protected
     */
    async continueQueue(control, command) {
        if (0 === command.actionData.length) {
            logger.d("Queue complete");
            await control.completeQueue();
            return;
        }
        if ("switchToUserInput" === command.actionData[0]) {
            await this.runSwitchToUser(control);
            await this.continueNextInQueue(control, command);
            return;
        }
        logger.d("Scheduling next in queue:", JSON.stringify(command));
        const queued = await control.continueQueue(command);
        if (!queued) {
            logger.d("Next command was not queued due to dispatch preconditions. Completitng...");
            await control.completeQueue();
        }
    }
    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @param control Chat control
     * @protected
     */
    async runSwitchToUser(control) {
        logger.d("Switching to user input");
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
exports.VertexAiQueueWorker = VertexAiQueueWorker;
//# sourceMappingURL=VertexAiQueueWorker.js.map