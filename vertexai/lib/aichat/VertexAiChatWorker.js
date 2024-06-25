"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiChatWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const CreateWorker_1 = require("./workers/CreateWorker");
const PostWorker_1 = require("./workers/PostWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
const CleanupWorker_1 = require("./workers/CleanupWorker");
const VertexAiChatCommand_1 = require("./data/VertexAiChatCommand");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("VertexAiChatWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class VertexAiChatWorker {
    getWorker(command, queueName) {
        logger.d("Dispatching VertexAi command...");
        const cleaner = this.chatCleanerFactory(queueName);
        if (PostWorker_1.ContinuePostWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new PostWorker_1.ContinuePostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory, cleaner, this.logData, this.messageMiddleware);
        }
        const action = command.actionData[0];
        if (CreateWorker_1.CreateWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CreateWorker");
            return new CreateWorker_1.CreateWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.chatCleanupRegistrar);
        }
        if (CleanupWorker_1.CleanupWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CleanupWorker");
            return new CleanupWorker_1.CleanupWorker(this.wrapper);
        }
        if (PostWorker_1.PostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostWorker");
            return new PostWorker_1.PostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory, cleaner, this.logData, this.messageMiddleware);
        }
        if (PostWorker_1.ExplicitPostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new PostWorker_1.ExplicitPostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory, cleaner, this.logData, this.messageMiddleware);
        }
        if (SwitchToUserWorker_1.SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker_1.SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        logger.w("Unsupported command:", command);
        return undefined;
    }
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    instructions, formatContinuationError, chatCleanupRegistrar, chatCleanerFactory, logData, messageMiddleware, getContinuationFactory) {
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
            return (0, firebase_ai_chat_core_1.toolContinuationDispatcherFactory)(this.firestore, dispatchers, this.scheduler, formatContinuationError, logData);
        });
        this.chatCleanerFactory = chatCleanerFactory;
        this.chatCleanupRegistrar = chatCleanupRegistrar;
        this.logData = logData;
        this.messageMiddleware = messageMiddleware;
    }
    async dispatch(req, onQueueComplete) {
        if ((0, VertexAiChatCommand_1.isVertexAiChatReq)(req)) {
            const worker = this.getWorker(req.data, req.queueName);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
exports.VertexAiChatWorker = VertexAiChatWorker;
//# sourceMappingURL=VertexAiChatWorker.js.map