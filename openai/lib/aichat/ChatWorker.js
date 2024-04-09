"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatWorker = void 0;
const firebase_admin_1 = require("firebase-admin");
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
var FieldValue = firebase_admin_1.firestore.FieldValue;
/**
 * Chat worker that dispatches chat commands and runs AI
 */
class ChatWorker extends firebase_ai_chat_core_1.BaseChatWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers) {
        super(firestore, scheduler);
        this.defaultDispatcher = (data) => Promise.resolve({ data: data });
        this.wrapper = wrapper;
        this.dispatchers = dispatchers;
    }
    isSupportedCommand(req) {
        return req.data.actions.every((action) => "string" === typeof action && ChatWorker.SUPPORTED_ACTIONS.includes(action));
    }
    async doDispatch(action, data, state) {
        switch (action) {
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
    }
    /**
     * Creates thread
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    async runCreateThread(commandData, state) {
        firebase_ai_chat_core_1.logger.d("Creating thread...");
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
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
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
        firebase_ai_chat_core_1.logger.d("Running assistant...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatcher);
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
        firebase_ai_chat_core_1.logger.d("Retrieving messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
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
        firebase_ai_chat_core_1.logger.d("Closing chat...");
        const threadId = state.config.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        return {
            status: "complete"
        };
    }
}
exports.ChatWorker = ChatWorker;
/**
 * Supported actions
 * @private
 */
ChatWorker.SUPPORTED_ACTIONS = [
    "create", "post", "run", "retrieve", "switchToUserInput", "close"
];
//# sourceMappingURL=ChatWorker.js.map