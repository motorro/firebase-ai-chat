"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatWorker = void 0;
const firebase_admin_1 = require("firebase-admin");
const Collections_1 = require("./data/Collections");
const logging_1 = require("../logging");
var FieldValue = firebase_admin_1.firestore.FieldValue;
const ChatError_1 = require("./data/ChatError");
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class ChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore, scheduler, wrapper, dispatchers // eslint-disable-line  @typescript-eslint/no-explicit-any
    ) {
        this.defaultDispatcher = (data) => Promise.resolve({ data: data });
        this.db = firestore;
        this.wrapper = wrapper;
        this.scheduler = scheduler;
        this.dispatchers = dispatchers;
    }
    /**
     * Dispatches command
     * @param req Dispatch request
     */
    async dispatch(req) {
        const command = req.data;
        logging_1.logger.d("Getting maximum retries for: ", req.queueName);
        logging_1.logger.d("Retries:", await this.scheduler.getQueueMaxRetries(req.queueName));
        try {
            switch (command.type) {
                case "create":
                    return await this.runCreateThread(command);
                case "post":
                    return await this.runPostMessages(command);
                case "run":
                    return await this.runRun(command);
                case "retrieve":
                    return await this.runRetrieve(command);
                case "close":
                    return await this.runClose(command);
            }
        }
        catch (e) {
            logging_1.logger.w("Error running command", e);
            if (isChatWorkerError(e)) {
                logging_1.logger.w("Possible duplicate run");
                return Promise.resolve();
            }
            if ((0, ChatError_1.isPermanentError)(e)) {
                logging_1.logger.w("Permanent error. Failing chat...");
                return await this.updateWithCheck(command, () => true, () => ({
                    status: "failed"
                }));
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logging_1.logger.w("Maximum retry count reached. Failing chat...");
                return await this.updateWithCheck(command, () => true, () => ({
                    status: "failed"
                }));
            }
            logging_1.logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            return Promise.reject(e);
        }
    }
    /**
     * Creates thread
     * @param command Command data
     * @private
     */
    async runCreateThread(command) {
        logging_1.logger.d(`Creating thread. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "creating" === status, async () => {
            const threadId = await this.wrapper.createThread({
                chat: command.chatDocumentPath
            });
            await this.updateWithCheck(command, (status) => "creating" === status, (state) => ({
                status: "created",
                config: Object.assign(Object.assign({}, state.config), { threadId: threadId })
            }));
        });
    }
    /**
     * Posts user messages of current dispatch
     * @param command Command data
     * @private
     */
    async runPostMessages(command) {
        logging_1.logger.d(`Posting message. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "posting" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logging_1.logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            const messageCollectionRef = this.getMessageCollection(command.chatDocumentPath);
            const messages = await messageCollectionRef
                .where("dispatchId", "==", command.dispatchId)
                .orderBy("inBatchSortIndex")
                .get();
            let latestMessageId = undefined;
            for (const message of messages.docs) {
                const data = message.data();
                if (undefined !== data) {
                    latestMessageId = await this.wrapper.postMessage(threadId, data.text);
                }
            }
            await this.updateWithCheck(command, (status) => "posting" === status, () => (Object.assign({ status: "processing" }, (undefined != latestMessageId ? { lastMessageId: latestMessageId } : {}))));
            const runCommand = Object.assign(Object.assign({}, command), { type: "run" });
            await this.scheduler.schedule(state.config.workerName, runCommand);
        });
    }
    /**
     * Runs assistant
     * @param command Command data
     * @private
     */
    async runRun(command) {
        logging_1.logger.d(`Running assistant. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "processing" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logging_1.logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
            const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);
            await this.updateWithCheck(command, (status) => "processing" === status, () => ({
                status: "gettingMessages",
                data: newData
            }));
            const retrieveCommand = Object.assign(Object.assign({}, command), { type: "retrieve" });
            await this.scheduler.schedule(state.config.workerName, retrieveCommand);
        });
    }
    /**
     * Retrieves new messages
     * @param command Command data
     * @private
     */
    async runRetrieve(command) {
        logging_1.logger.d(`Retrieving messages. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "gettingMessages" === status, async (state) => {
            var _a;
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logging_1.logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            const messageCollectionRef = this.getMessageCollection(command.chatDocumentPath);
            const messagesSoFar = await messageCollectionRef
                .where("dispatchId", "==", command.dispatchId)
                .orderBy("inBatchSortIndex", "desc")
                .limit(1)
                .get();
            const latestInBatchId = ((messagesSoFar.size > 0 && ((_a = messagesSoFar.docs[0].data()) === null || _a === void 0 ? void 0 : _a.inBatchSortIndex)) || -1) + 1;
            const newMessages = await this.wrapper.getMessages(threadId, state.lastMessageId);
            const batch = this.db.batch();
            newMessages.messages.forEach(([id, message], index) => {
                batch.set(messageCollectionRef.doc(`ai_${id}`), {
                    userId: command.ownerId,
                    dispatchId: command.dispatchId,
                    author: "ai",
                    text: message,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
            await this.updateWithCheck(command, (status) => "gettingMessages" === status, () => ({
                status: "userInput",
                lastMessageId: newMessages.latestMessageId
            }));
        });
    }
    /**
     * Closes chat
     * @param command Command data
     * @private
     */
    async runClose(command) {
        logging_1.logger.d(`Closing chat. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        return await this.withCheckedState(command, (status) => "closing" === status, async (state) => {
            const threadId = state.config.threadId;
            if (undefined === threadId) {
                logging_1.logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
            }
            await this.wrapper.deleteThread(threadId);
            await this.updateWithCheck(command, (status) => "posting" === status, () => ({
                status: "complete"
            }));
        });
    }
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @private
     */
    getMessageCollection(chatDocumentPath) {
        return this.db
            .doc(chatDocumentPath)
            .collection(Collections_1.Collections.messages);
    }
    async checkState(state, command, checkStatus) {
        if (undefined === state) {
            logging_1.logger.w("Chat not found: ", command.chatDocumentPath);
            return Promise.reject(new ChatWorkerError("not-found", "Chat not found"));
        }
        if (false === checkStatus(state.status) || command.dispatchId !== state.dispatchId) {
            logging_1.logger.w("Chat is not in the expected state/dispatch");
            return Promise.reject(new ChatWorkerError("failed-precondition", "Chat status conflict"));
        }
        return state;
    }
    async withCheckedState(command, checkStatus, block) {
        logging_1.logger.d("Getting chat state: ", command.chatDocumentPath);
        const doc = this.db.doc(command.chatDocumentPath);
        const state = (await doc.get()).data();
        return await block(await this.checkState(state, command, checkStatus));
    }
    async updateWithCheck(command, checkStatus, block) {
        logging_1.logger.d("Updating chat state: ", command.chatDocumentPath);
        return await this.db.runTransaction(async (tx) => {
            const doc = this.db.doc(command.chatDocumentPath);
            const state = (await tx.get(doc)).data();
            tx.set(doc, Object.assign(Object.assign({}, block(await this.checkState(state, command, checkStatus))), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
        });
    }
}
exports.ChatWorker = ChatWorker;
/**
 * Internal error for flow alteration
 */
class ChatWorkerError extends ChatError_1.ChatError {
    constructor(code, message, details) {
        super(code, true, message, details);
        this.isDispatchError = true;
    }
}
/**
 * Checks if something is ChatWorkerError
 * @param something Some object
 * @return true if something is a ChatWorkerError
 */
function isChatWorkerError(something) {
    return "object" === typeof something && null != something && "isDispatchError" in something && true === something.isDispatchError;
}
//# sourceMappingURL=ChatWorker.js.map