"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiChatWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const CreateWorker_1 = require("./workers/CreateWorker");
const CloseWorker_1 = require("./workers/CloseWorker");
const PostWorker_1 = require("./workers/PostWorker");
const RetrieveWorker_1 = require("./workers/RetrieveWorker");
const RunWorker_1 = require("./workers/RunWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class OpenAiChatWorker {
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers) {
        this.workers = [
            new CloseWorker_1.CloseWorker(firestore, scheduler, wrapper, dispatchers),
            new CreateWorker_1.CreateWorker(firestore, scheduler, wrapper, dispatchers),
            new PostWorker_1.PostWorker(firestore, scheduler, wrapper, dispatchers),
            new RetrieveWorker_1.RetrieveWorker(firestore, scheduler, wrapper, dispatchers),
            new RunWorker_1.RunWorker(firestore, scheduler, wrapper, dispatchers),
            new SwitchToUserWorker_1.SwitchToUserWorker(firestore, scheduler, wrapper, dispatchers)
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
exports.OpenAiChatWorker = OpenAiChatWorker;
//# sourceMappingURL=OpenAiChatWorker.js.map