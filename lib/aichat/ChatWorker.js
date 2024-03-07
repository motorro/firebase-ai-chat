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
        await this.dispatchWithCheck(req, async (command, data, state) => {
            switch (command) {
                case "create":
                    return await this.runCreateThread(data, state);
                case "post":
                    return await this.runPostMessages(data, state);
                case "run":
                    return await this.runRun(state);
                case "retrieve":
                    return await this.runRetrieve(data, state);
                case "switchToUserInput":
                    return await this.runSwitchToUser();
                case "close":
                    return await this.runClose(state);
            }
        });
    }
    /**
     * Creates thread
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    async runCreateThread(commandData, state) {
        logging_1.logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: commandData.chatDocumentPath
        });
        return {
            config: Object.assign(Object.assign({}, state.config), { threadId: threadId })
        };
    }
    /**
     * Posts user messages of current dispatch
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    async runPostMessages(commandData, state) {
        logging_1.logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logging_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messageCollectionRef = this.getMessageCollection(commandData.chatDocumentPath);
        const messages = await messageCollectionRef
            .where("dispatchId", "==", commandData.dispatchId)
            .orderBy("inBatchSortIndex")
            .get();
        let latestMessageId = undefined;
        for (const message of messages.docs) {
            const data = message.data();
            if (undefined !== data) {
                latestMessageId = await this.wrapper.postMessage(threadId, data.text);
            }
        }
        return Object.assign({}, (undefined != latestMessageId ? { lastMessageId: latestMessageId } : {}));
    }
    /**
     * Runs assistant
     * @param state Chat state
     * @private
     */
    async runRun(state) {
        logging_1.logger.d("Running assistant...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logging_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);
        return {
            data: newData
        };
    }
    /**
     * Retrieves new messages
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    async runRetrieve(commandData, state) {
        var _a;
        logging_1.logger.d("Retrieving messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logging_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const messageCollectionRef = this.getMessageCollection(commandData.chatDocumentPath);
        const messagesSoFar = await messageCollectionRef
            .where("dispatchId", "==", commandData.dispatchId)
            .orderBy("inBatchSortIndex", "desc")
            .limit(1)
            .get();
        const latestInBatchId = ((messagesSoFar.size > 0 && ((_a = messagesSoFar.docs[0].data()) === null || _a === void 0 ? void 0 : _a.inBatchSortIndex)) || -1) + 1;
        const newMessages = await this.wrapper.getMessages(threadId, state.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach(([id, message], index) => {
            batch.set(messageCollectionRef.doc(`ai_${id}`), {
                userId: commandData.ownerId,
                dispatchId: commandData.dispatchId,
                author: "ai",
                text: message,
                inBatchSortIndex: latestInBatchId + index,
                createdAt: FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        return {
            lastMessageId: newMessages.latestMessageId
        };
    }
    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @private
     */
    async runSwitchToUser() {
        return {
            status: "userInput"
        };
    }
    /**
     * Closes chat
     * @param state Chat state
     * @private
     */
    async runClose(state) {
        logging_1.logger.d("Closing chat...");
        const threadId = state.config.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        return {
            status: "complete"
        };
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
    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req
     * @param processAction
     * @private
     */
    async dispatchWithCheck(req, processAction) {
        const db = this.db;
        const command = req.data;
        const doc = this.db.doc(command.chatDocumentPath);
        const runDoc = doc.collection(Collections_1.Collections.dispatches).doc(command.dispatchId).collection(Collections_1.Collections.runs).doc(req.id);
        const action = command.actions[0];
        if (undefined === action) {
            logging_1.logger.w("Empty command queue in command", JSON.stringify(command));
            return;
        }
        logging_1.logger.d(`Dispatching action ${action} (0 of ${command.actions.length} for document: ${command.chatDocumentPath}`);
        const stateToDispatch = await db.runTransaction(async (tx) => {
            const state = (await tx.get(doc)).data();
            if (undefined === state) {
                logging_1.logger.w("Chat not found. Aborting...");
                return undefined;
            }
            if (command.dispatchId !== state.latestDispatchId) {
                logging_1.logger.w("Another command is dispatched. Aborting...");
                return undefined;
            }
            const run = await tx.get(runDoc);
            if (run.exists) {
                const runData = run.data();
                if ("complete" === (runData === null || runData === void 0 ? void 0 : runData.status)) {
                    logging_1.logger.w("Already done. Aborting...");
                    return undefined;
                }
                if ("running" === (runData === null || runData === void 0 ? void 0 : runData.status)) {
                    logging_1.logger.w("Already running. Aborting...");
                    return undefined;
                }
            }
            tx.set(runDoc, { status: "running", runAttempt: req.retryCount, createdAt: FieldValue.serverTimestamp() });
            return state;
        });
        if (undefined === stateToDispatch) {
            logging_1.logger.w("Aborting...");
            return;
        }
        let resultState;
        try {
            resultState = await processAction(action, command, stateToDispatch);
        }
        catch (e) {
            if ((0, ChatError_1.isPermanentError)(e)) {
                logging_1.logger.w("Permanent error. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            const retryCount = req.retryCount;
            const maxRetries = await this.scheduler.getQueueMaxRetries(req.queueName);
            if (maxRetries != -1 && retryCount + 1 == maxRetries) {
                logging_1.logger.w("Maximum retry count reached. Failing chat...");
                await updateWithCheck("complete", {
                    status: "failed"
                });
                return;
            }
            logging_1.logger.d(`Scheduling retry ${retryCount} of ${maxRetries}`);
            await updateWithCheck("waitingForRetry", null);
            return Promise.reject(e);
        }
        await updateWithCheck("complete", resultState);
        if (command.actions.length > 1) {
            logging_1.logger.d("Dispatching next command...");
            await this.scheduler.schedule(req.queueName, Object.assign(Object.assign({}, command), { actions: command.actions.slice(1) }));
        }
        else {
            logging_1.logger.d("Command queue complete");
        }
        async function updateWithCheck(runStatus, state) {
            return await db.runTransaction(async (tx) => {
                if (null !== state) {
                    const stateData = (await tx.get(doc)).data();
                    if (command.dispatchId === (stateData === null || stateData === void 0 ? void 0 : stateData.latestDispatchId)) {
                        tx.set(doc, state, { merge: true });
                    }
                }
                tx.set(runDoc, { status: runStatus }, { merge: true });
            });
        }
    }
}
exports.ChatWorker = ChatWorker;
//# sourceMappingURL=ChatWorker.js.map