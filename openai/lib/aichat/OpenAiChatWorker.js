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
const engineId_1 = require("../engineId");
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
            new HandBackCleanupWorker_1.HandBackCleanupFactory(firestore, scheduler, wrapper)
        ];
    }
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    getFactory(req) {
        return "engine" in req.data && engineId_1.engineId === req.data.engine
            && Array.isArray(req.data.actionData)
            && undefined !== req.data.actionData[0]
            && this.workers.find((w) => w.isSupportedAction(req.data.actionData[0]));
    }
    async dispatch(req, onQueueComplete) {
        const factory = this.getFactory(req);
        if (factory) {
            return await factory.create().dispatch(req, onQueueComplete);
        }
        else {
            return false;
        }
    }
}
exports.OpenAiChatWorker = OpenAiChatWorker;
//# sourceMappingURL=OpenAiChatWorker.js.map