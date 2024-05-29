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
const PostExplicitWorker_1 = require("./workers/PostExplicitWorker");
const HandBackCleanupWorker_1 = require("./workers/HandBackCleanupWorker");
const RunContinuationWorker_1 = require("./workers/RunContinuationWorker");
const OpenAiChatCommand_1 = require("./data/OpenAiChatCommand");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class OpenAiChatWorker {
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory) {
        this.firestore = firestore;
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.toolsDispatchFactory = toolsDispatchFactory;
    }
    getWorker(command) {
        firebase_ai_chat_core_1.logger.d("Dispatching OpenAi command...");
        if (RunContinuationWorker_1.RunContinuationWorker.isSupportedCommand(command)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with ContinuePostWorker");
            return new RunContinuationWorker_1.RunContinuationWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
        }
        const action = command.actionData[0];
        if (CloseWorker_1.CloseWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with CloseWorker");
            return new CloseWorker_1.CloseWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (CreateWorker_1.CreateWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with CreateWorker");
            return new CreateWorker_1.CreateWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (HandBackCleanupWorker_1.HandBackCleanupWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with HandBackCleanupWorker");
            return new HandBackCleanupWorker_1.HandBackCleanupWorker(this.wrapper);
        }
        if (PostWorker_1.PostWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with PostWorker");
            return new PostWorker_1.PostWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (PostExplicitWorker_1.PostExplicitWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with PostExplicitWorker");
            return new PostExplicitWorker_1.PostExplicitWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (RetrieveWorker_1.RetrieveWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with RetrieveWorker");
            return new RetrieveWorker_1.RetrieveWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (RunWorker_1.RunWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with RunWorker");
            return new RunWorker_1.RunWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
        }
        if (SwitchToUserWorker_1.SwitchToUserWorker.isSupportedAction(action)) {
            firebase_ai_chat_core_1.logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker_1.SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
        }
        firebase_ai_chat_core_1.logger.w("Unsupported command:", command);
        return undefined;
    }
    async dispatch(req, onQueueComplete) {
        if ((0, OpenAiChatCommand_1.isOpenAiChatReq)(req)) {
            const worker = this.getWorker(req.data);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
exports.OpenAiChatWorker = OpenAiChatWorker;
//# sourceMappingURL=OpenAiChatWorker.js.map