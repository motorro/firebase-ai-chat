"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiChatWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const CreateWorker_1 = require("./workers/CreateWorker");
const CloseWorker_1 = require("./workers/CloseWorker");
const PostWorker_1 = require("./workers/PostWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
const HandBackCleanupWorker_1 = require("./workers/HandBackCleanupWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class VertexAiChatWorker {
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    instructions) {
        this.workers = [
            new CloseWorker_1.CloseWorker(firestore, scheduler, wrapper, instructions),
            new CreateWorker_1.CreateWorker(firestore, scheduler, wrapper, instructions),
            new PostWorker_1.PostWorker(firestore, scheduler, wrapper, instructions),
            new PostWorker_1.ExplicitPostWorker(firestore, scheduler, wrapper, instructions),
            new SwitchToUserWorker_1.SwitchToUserWorker(firestore, scheduler, wrapper, instructions),
            new HandBackCleanupWorker_1.HandBackCleanupWorker(wrapper)
        ];
    }
    async dispatch(req, onQueueComplete) {
        for (let i = 0; i < this.workers.length; ++i) {
            if (await this.workers[i].dispatch(req, onQueueComplete)) {
                return true;
            }
        }
        firebase_ai_chat_core_1.logger.d("Didn't find worker for command:", JSON.stringify(req.data));
        return false;
    }
}
exports.VertexAiChatWorker = VertexAiChatWorker;
//# sourceMappingURL=VertexAiChatWorker.js.map