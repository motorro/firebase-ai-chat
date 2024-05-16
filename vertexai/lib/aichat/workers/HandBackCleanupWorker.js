"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandBackCleanupWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiChatAction_1 = require("../data/VertexAiChatAction");
/**
 * Cleans-up OpenAI thread on hand-back
 */
class HandBackCleanupWorker {
    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper) {
        this.wrapper = wrapper;
    }
    getAction(req) {
        const action = "engine" in req.data && "vertexai" === req.data.engine
            && Array.isArray(req.data.actionData)
            && req.data.actionData[0];
        if ((0, VertexAiChatAction_1.isHandBackCleanupAction)(action)) {
            return action;
        }
        return undefined;
    }
    async dispatch(req) {
        const action = this.getAction(req);
        if (undefined !== action) {
            firebase_ai_chat_core_1.logger.d("Deleting thread...");
            const threadId = action.config.threadId;
            if (undefined !== threadId) {
                await this.wrapper.deleteThread(threadId);
            }
            return true;
        }
        return false;
    }
}
exports.HandBackCleanupWorker = HandBackCleanupWorker;
//# sourceMappingURL=HandBackCleanupWorker.js.map