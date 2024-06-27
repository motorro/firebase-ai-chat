"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrieveWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("RetrieveWorker");
class RetrieveWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "retrieve" === action;
    }
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     * @param messageMiddleware Message processing middleware
     *
     */
    constructor(firestore, scheduler, wrapper, cleaner, logData, messageMiddleware) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.messageMiddleware = messageMiddleware;
    }
    async doDispatch(command, state, control) {
        logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);
        await this.updateConfig(control, state, () => ({ lastMessageId: newMessages.latestMessageId }));
        await this.processMessages(command, state, async (messages, _document, _state, mpc) => {
            await mpc.safeUpdate(async (_tx, _updateState, saveMessages) => {
                saveMessages(messages);
            });
            await this.continueNextInQueue(control, command);
        }, control, this.messageMiddleware, newMessages.messages.map(([, message]) => message));
    }
}
exports.RetrieveWorker = RetrieveWorker;
//# sourceMappingURL=RetrieveWorker.js.map