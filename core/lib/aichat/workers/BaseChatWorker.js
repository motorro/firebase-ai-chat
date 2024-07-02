"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseChatWorker = void 0;
const firebase_admin_1 = require("firebase-admin");
const Collections_1 = require("../data/Collections");
const logging_1 = require("../../logging");
const TaskScheduler_1 = require("../TaskScheduler");
const ChatCommand_1 = require("../data/ChatCommand");
const DispatchRunner_1 = require("./DispatchRunner");
const NewMessage_1 = require("../data/NewMessage");
var FieldValue = firebase_admin_1.firestore.FieldValue;
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
    /**
     * Saves chat messages
     * @param tx Update transaction
     * @param nextInBatchIndex Next index in batch
     * @param ownerId Chat owner
     * @param chatDocumentPath Chat document path
     * @param dispatchId Dispatch ID
     * @param sessionId Session ID
     * @param messages A list of messages to save
     * @param chatMeta Chat metadata
     * @protected
     */
    saveMessages(tx, nextInBatchIndex, ownerId, chatDocumentPath, dispatchId, sessionId, messages, chatMeta) {
        const messageCollectionRef = this.getMessageCollection(chatDocumentPath);
        messages.forEach((message) => {
            let text;
            let data = null;
            let meta = (chatMeta === null || chatMeta === void 0 ? void 0 : chatMeta.aiMessageMeta) || null;
            if ((0, NewMessage_1.isStructuredMessage)(message)) {
                text = message.text;
                data = message.data || null;
                if (message.meta) {
                    if (null != meta) {
                        meta = Object.assign(Object.assign({}, meta), message.meta);
                    }
                    else {
                        meta = message.meta;
                    }
                }
            }
            else {
                text = String(message);
            }
            tx.set(messageCollectionRef.doc(), Object.assign({ userId: ownerId, dispatchId: dispatchId, author: "ai", text: text, data: data, inBatchSortIndex: nextInBatchIndex++, createdAt: FieldValue.serverTimestamp(), meta: meta }, (sessionId ? { sessionId: sessionId } : {})));
        });
        return nextInBatchIndex;
    }
    /**
     * Runs AI message processing
     * @param command Chat command
     * @param chatState Current chat state
     * @param defaultProcessor Default message processor
     * @param control Dispatch control
     * @param middleware Message middleware
     * @param messages Messages to process
     * @protected
     */
    async processMessages(command, chatState, defaultProcessor, control, middleware, messages) {
        let currentChatState = chatState;
        const createMpControl = (next) => {
            return {
                safeUpdate: async (update) => {
                    return await control.safeUpdate(async (tx, updateChatState) => {
                        var _a, _b;
                        const dispatchDoc = this.db.doc(command.commonData.chatDocumentPath).collection(Collections_1.Collections.dispatches).doc(command.commonData.dispatchId);
                        let nextMessageIndex = ((_b = (_a = (await dispatchDoc.get())) === null || _a === void 0 ? void 0 : _a.data()) === null || _b === void 0 ? void 0 : _b.nextMessageIndex) || 0;
                        await update(tx, (newState) => {
                            const update = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (newState.config ? { config: newState.config } : {})), (newState.status ? { status: newState.status } : {})), (newState.data ? { data: newState.data } : {})), (newState.meta ? { meta: newState.meta } : {})), (newState.sessionId ? { sessionId: newState.sessionId } : {}));
                            currentChatState = Object.assign(currentChatState, update);
                            updateChatState(update);
                        }, (messages) => {
                            nextMessageIndex = this.saveMessages(tx, nextMessageIndex, command.commonData.ownerId, command.commonData.chatDocumentPath, command.commonData.dispatchId, chatState.sessionId, messages, chatState.meta);
                        });
                        tx.set(dispatchDoc, { nextMessageIndex: nextMessageIndex }, { merge: true });
                    });
                },
                next: next,
                enqueue: control.schedule,
                completeQueue: control.completeQueue
            };
        };
        let start = async (messages) => {
            await defaultProcessor(messages, command.commonData.chatDocumentPath, currentChatState, createMpControl(() => Promise.resolve()));
        };
        for (let i = middleware.length - 1; i >= 0; --i) {
            const mpControl = createMpControl(start);
            start = (messages) => {
                return middleware[i](messages, command.commonData.chatDocumentPath, currentChatState, mpControl);
            };
        }
        await start(messages);
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
        return this.runner.dispatchWithCheck(req, async (soFar, chatCommand, safeUpdate) => {
            const command = (0, ChatCommand_1.isBoundChatCommand)(chatCommand) ? chatCommand.command : chatCommand;
            const control = {
                safeUpdate: safeUpdate,
                schedule: async (command) => {
                    logger.d("Scheduling command: ", JSON.stringify(command));
                    return (0, TaskScheduler_1.scheduleCommand)(this.scheduler, req.queueName, command);
                },
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