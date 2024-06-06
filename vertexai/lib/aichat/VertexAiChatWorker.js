"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiChatWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const CreateWorker_1 = require("./workers/CreateWorker");
const CloseWorker_1 = require("./workers/CloseWorker");
const PostWorker_1 = require("./workers/PostWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
const HandBackCleanupWorker_1 = require("./workers/HandBackCleanupWorker");
const VertexAiChatCommand_1 = require("./data/VertexAiChatCommand");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("VertexAiChatWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class VertexAiChatWorker {
    getWorker(command) {
        logger.d("Dispatching VertexAi command...");
        if (PostWorker_1.ContinuePostWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new PostWorker_1.ContinuePostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }
        const action = command.actionData[0];
        if (CloseWorker_1.CloseWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CloseWorker");
            return new CloseWorker_1.CloseWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (CreateWorker_1.CreateWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CreateWorker");
            return new CreateWorker_1.CreateWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (HandBackCleanupWorker_1.HandBackCleanupWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with HandBackCleanupWorker");
            return new HandBackCleanupWorker_1.HandBackCleanupWorker(this.wrapper);
        }
        if (PostWorker_1.PostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostWorker");
            return new PostWorker_1.PostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }
        if (PostWorker_1.ExplicitPostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new PostWorker_1.ExplicitPostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }
        if (SwitchToUserWorker_1.SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker_1.SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
        }
        logger.w("Unsupported command:", command);
        return undefined;
    }
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    instructions, getContinuationFactory) {
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.instructions = instructions;
        this.getContinuationFactory = getContinuationFactory || (() => {
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            const dispatchers = {};
            Object.keys(this.instructions).forEach((id) => {
                var _a, _b;
                const dispatcher = (_b = (_a = this.instructions[id]) === null || _a === void 0 ? void 0 : _a.tools) === null || _b === void 0 ? void 0 : _b.dispatcher;
                if (undefined !== dispatcher) {
                    dispatchers[id] = dispatcher;
                }
            });
            return (0, firebase_ai_chat_core_1.toolContinuationDispatcherFactory)(this.firestore, dispatchers, this.scheduler);
        });
    }
    async dispatch(req, onQueueComplete) {
        if ((0, VertexAiChatCommand_1.isVertexAiChatReq)(req)) {
            const worker = this.getWorker(req.data);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
exports.VertexAiChatWorker = VertexAiChatWorker;
//# sourceMappingURL=VertexAiChatWorker.js.map