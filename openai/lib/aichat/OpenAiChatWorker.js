"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiChatWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const CreateWorker_1 = require("./workers/CreateWorker");
const PostWorker_1 = require("./workers/PostWorker");
const RetrieveWorker_1 = require("./workers/RetrieveWorker");
const RunWorker_1 = require("./workers/RunWorker");
const SwitchToUserWorker_1 = require("./workers/SwitchToUserWorker");
const PostExplicitWorker_1 = require("./workers/PostExplicitWorker");
const CleanupWorker_1 = require("./workers/CleanupWorker");
const RunContinuationWorker_1 = require("./workers/RunContinuationWorker");
const OpenAiChatCommand_1 = require("./data/OpenAiChatCommand");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("OpenAiChatWorker");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class OpenAiChatWorker {
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory, chatCleanupRegistrar, chatCleanerFactory, logData, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    messageMiddleware) {
        this.firestore = firestore;
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.toolsDispatchFactory = toolsDispatchFactory;
        this.chatCleanerFactory = chatCleanerFactory;
        this.chatCleanupRegistrar = chatCleanupRegistrar;
        this.logData = logData;
        this.messageMiddleware = messageMiddleware;
    }
    getWorker(command, queueName) {
        logger.d("Dispatching OpenAi command...");
        const cleaner = this.chatCleanerFactory(queueName);
        if (RunContinuationWorker_1.RunContinuationWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new RunContinuationWorker_1.RunContinuationWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory, cleaner, this.logData);
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
            return new PostWorker_1.PostWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        if (PostExplicitWorker_1.PostExplicitWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostExplicitWorker");
            return new PostExplicitWorker_1.PostExplicitWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        if (RetrieveWorker_1.RetrieveWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RetrieveWorker");
            return new RetrieveWorker_1.RetrieveWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.messageMiddleware);
        }
        if (RunWorker_1.RunWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RunWorker");
            return new RunWorker_1.RunWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.toolsDispatchFactory, this.logData);
        }
        if (SwitchToUserWorker_1.SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker_1.SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        logger.w("Unsupported command:", command);
        return undefined;
    }
    async dispatch(req, onQueueComplete) {
        if ((0, OpenAiChatCommand_1.isOpenAiChatReq)(req)) {
            const worker = this.getWorker(req.data, req.queueName);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
exports.OpenAiChatWorker = OpenAiChatWorker;
//# sourceMappingURL=OpenAiChatWorker.js.map