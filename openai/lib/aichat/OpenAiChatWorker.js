"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiChatWorker = void 0;
const CreateWorker_1 = require("./workers/CreateWorker");
const CloseWorker_1 = require("./workers/CloseWorker");
const PostWorker_1 = require("./workers/PostWorker");
const RetrieveWorker_1 = require("./workers/RetrieveWorker");
const RunWorker_1 = require("./workers/RunWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
const PostExplicitWorker_1 = require("./workers/PostExplicitWorker");
const HandBackCleanupWorker_1 = require("./workers/HandBackCleanupWorker");
const RunContinuationWorker_1 = require("./workers/RunContinuationWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class OpenAiChatWorker {
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory) {
        this.workers = [
            new CloseWorker_1.CloseFactory(firestore, scheduler, wrapper),
            new CreateWorker_1.CreateFactory(firestore, scheduler, wrapper),
            new PostWorker_1.PostFactory(firestore, scheduler, wrapper),
            new PostExplicitWorker_1.PostExplicitFactory(firestore, scheduler, wrapper),
            new RetrieveWorker_1.RetrieveFactory(firestore, scheduler, wrapper),
            new RunWorker_1.RunFactory(firestore, scheduler, wrapper, toolsDispatchFactory),
            new SwitchToUserWorker_1.SwitchToUserFactory(firestore, scheduler, wrapper),
            new HandBackCleanupWorker_1.HandBackCleanupFactory(firestore, scheduler, wrapper),
            new RunContinuationWorker_1.RunContinuationFactory(firestore, scheduler, wrapper, toolsDispatchFactory)
        ];
    }
    getFactory(req) {
        return this.workers.find((w) => w.isSupportedCommand(req.data));
    }
    async dispatch(req, onQueueComplete) {
        const factory = this.getFactory(req);
        if (factory) {
            return await factory.create(req.queueName).dispatch(req, onQueueComplete);
        }
        else {
            return false;
        }
    }
}
exports.OpenAiChatWorker = OpenAiChatWorker;
//# sourceMappingURL=OpenAiChatWorker.js.map