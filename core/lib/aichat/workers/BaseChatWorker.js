"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseChatWorker = void 0;
const Collections_1 = require("../data/Collections");
const logging_1 = require("../../logging");
const ChatCommand_1 = require("../data/ChatCommand");
const DispatchRunner_1 = require("./DispatchRunner");
const logger = (0, logging_1.tagLogger)("BaseChatWorker");
/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
class BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     */
    constructor(firestore, scheduler, cleaner, logData) {
        this.db = firestore;
        this.scheduler = scheduler;
        this.runner = new DispatchRunner_1.DispatchRunner(firestore, scheduler, cleaner, logData);
    }
    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    async dispatch(req, onQueueComplete) {
        if (this.isSupportedCommand(req)) {
            logger.d("Dispatching command: ", JSON.stringify(req.data));
            await this.dispatchWithCheck(req, onQueueComplete, async (command, state, control) => {
                return await this.doDispatch(command, state, control);
            });
            return true;
        }
        return false;
    }
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @protected
     */
    getMessageCollection(chatDocumentPath) {
        return this.db
            .doc(chatDocumentPath)
            .collection(Collections_1.Collections.messages);
    }
    /**
     * Creates chat message query
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Collection query to get chat messages
     * @protected
     */
    getThreadMessageQuery(chatDocumentPath, dispatchId) {
        let query = this.getMessageCollection(chatDocumentPath);
        if (undefined !== dispatchId) {
            query = query.where("dispatchId", "==", dispatchId);
        }
        return query;
    }
    /**
     * Retrieves chat messages
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Chat messages if any
     * @protected
     */
    async getMessages(chatDocumentPath, dispatchId) {
        const messages = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex")
            .get();
        const result = [];
        messages.docs.forEach((doc) => {
            const data = doc.data();
            if (undefined !== data) {
                result.push(data);
            }
        });
        return result;
    }
    async getNextBatchSortIndex(chatDocumentPath, dispatchId) {
        var _a;
        const messagesSoFar = await this.getThreadMessageQuery(chatDocumentPath, dispatchId)
            .orderBy("inBatchSortIndex", "desc")
            .limit(1)
            .get();
        return ((messagesSoFar.size > 0 && ((_a = messagesSoFar.docs[0].data()) === null || _a === void 0 ? void 0 : _a.inBatchSortIndex)) || -1) + 1;
    }
    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    async dispatchWithCheck(req, onQueueComplete, processAction) {
        return this.runner.dispatchWithCheck(req, async (soFar, chatCommand, updateState) => {
            const command = (0, ChatCommand_1.isBoundChatCommand)(chatCommand) ? chatCommand.command : chatCommand;
            const control = {
                updateChatState: updateState,
                continueQueue: async (next) => {
                    logger.d("Scheduling next step: ", JSON.stringify(next));
                    let command;
                    let queueName = req.queueName;
                    if ((0, ChatCommand_1.isBoundChatCommand)(chatCommand)) {
                        command = chatCommand.command;
                        queueName = chatCommand.queueName;
                    }
                    else {
                        command = next;
                    }
                    if (command.commonData.dispatchId === soFar.latestDispatchId) {
                        await this.scheduler.schedule(queueName, command);
                        logger.d("Command scheduled");
                        return true;
                    }
                    logger.d("Chat is dispatching another command. Ignoring...");
                    return false;
                },
                completeQueue: async () => {
                    logger.d("Command queue complete");
                    if (undefined !== onQueueComplete) {
                        logger.d("Running queue complete handler...");
                        try {
                            await onQueueComplete(command.commonData.chatDocumentPath, command.commonData.meta);
                        }
                        catch (e) {
                            logger.w("Error running complete handler", e);
                        }
                    }
                }
            };
            await processAction(command, soFar, control);
        });
    }
}
exports.BaseChatWorker = BaseChatWorker;
//# sourceMappingURL=BaseChatWorker.js.map