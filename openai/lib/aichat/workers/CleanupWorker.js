"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiChatAction_1 = require("../data/OpenAiChatAction");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("CleanupWorker");
/**
 * Cleans-up OpenAI thread on hand-back
 */
class CleanupWorker {
    static isSupportedAction(action) {
        return (0, OpenAiChatAction_1.isCleanupAction)(action);
    }
    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper) {
        this.wrapper = wrapper;
    }
    getAction(req) {
        const action = "engine" in req.data && "openai" === req.data.engine
            && Array.isArray(req.data.actionData)
            && req.data.actionData[0];
        if ((0, OpenAiChatAction_1.isCleanupAction)(action)) {
            return action;
        }
        return undefined;
    }
    async dispatch(req) {
        const action = this.getAction(req);
        if (undefined !== action) {
            logger.d("Deleting thread...");
            const threadId = action.config.threadId;
            if (undefined !== threadId) {
                await this.wrapper.deleteThread(threadId);
            }
            return true;
        }
        return false;
    }
}
exports.CleanupWorker = CleanupWorker;
//# sourceMappingURL=CleanupWorker.js.map