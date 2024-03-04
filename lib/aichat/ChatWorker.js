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
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore, wrapper, dispatchers // eslint-disable-line  @typescript-eslint/no-explicit-any
    ) {
        this.defaultDispatcher = (data) => Promise.resolve({ data: data });
        this.db = firestore;
        this.wrapper = wrapper;
        this.dispatchers = dispatchers;
    }
    /**
     * Set as a trigger to document creation in command collection
     * @param command Command data
     */
    async runCommand(command) {
        switch (command.type) {
            case "post":
                await this.processWithCheck("dispatching", command, async (state) => await this.runPostChat(state, command));
                break;
            case "close":
                await this.processWithCheck("dispatching", command, async (state) => await this.closeThread(state, command));
                break;
            default:
                logging_1.logger.e("Unknown command: ", command);
        }
    }
    /**
     * Posts messages and runs assistant
     * @param state Chat state
     * @param command Command data
     * @private
     */
    async runPostChat(state, command) {
        logging_1.logger.d(`Inserting messages. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        const messageCollectionRef = this.db
            .doc(command.chatDocumentPath)
            .collection(Collections_1.Collections.messages);
        const messages = await messageCollectionRef
            .where("dispatchId", "==", command.dispatchId)
            .orderBy("inBatchSortIndex")
            .get();
        const toPost = [];
        let latestInBatchId = 0;
        for (const msgDoc of messages.docs) {
            const data = msgDoc.data();
            if (undefined !== data) {
                toPost.push(data.text);
                latestInBatchId = data.inBatchSortIndex;
            }
        }
        ++latestInBatchId;
        if (0 === toPost.length) {
            await this.updateIfChecked("processing", command, (tx, state) => {
                const newState = Object.assign(Object.assign({}, state), { status: "userInput" });
                tx.set(this.db.doc(command.chatDocumentPath), Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
                return newState;
            });
            return;
        }
        let threadId = state.config.threadId;
        // 1. Post messages
        if (undefined === threadId) {
            logging_1.logger.d(`Creating thread. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
            threadId = await this.wrapper.createThread({
                chat: command.chatDocumentPath
            });
        }
        let latestMessage = await this.wrapper.postMessages(threadId, toPost);
        // 2. Run assistant
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);
        // 3. Get new messages
        logging_1.logger.d(`Getting messages, runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        const newMessages = await this.wrapper.getMessages(threadId, latestMessage);
        latestMessage = newMessages.latestMessageId;
        const batch = this.db.batch();
        newMessages.messages.forEach((message, index) => {
            batch.set(messageCollectionRef.doc(), {
                userId: command.ownerId,
                dispatchId: command.dispatchId,
                author: "ai",
                text: message,
                inBatchSortIndex: latestInBatchId + index,
                createdAt: FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        // Recheck current status in case the chat was altered concurrently
        // as AI takes a long time to process
        await this.updateIfChecked("processing", command, (tx, state) => {
            const newState = Object.assign(Object.assign({}, state), { status: "userInput", data: newData, config: Object.assign(Object.assign({}, state.config), { threadId: threadId }), lastMessageId: latestMessage });
            tx.set(this.db.doc(command.chatDocumentPath), Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
            return newState;
        });
    }
    async closeThread(state, command) {
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logging_1.logger.d("No thread. Returning...");
            return;
        }
        logging_1.logger.d("Closing chat thread", threadId);
        try {
            await this.wrapper.deleteThread(threadId);
        }
        catch (e) {
            logging_1.logger.w("Error deleting thread", e);
        }
        // Recheck current status in case the chat was altered concurrently
        // as AI takes a long time to process
        await this.updateIfChecked("processing", command, (tx, state) => {
            const newState = Object.assign(Object.assign({}, state), { status: "complete" });
            tx.set(this.db.doc(command.chatDocumentPath), Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }), { merge: true });
            return newState;
        });
    }
    async updateWithCheck(status, command, block) {
        return await this.db.runTransaction(async (tx) => {
            const doc = await tx.get(this.db.doc(command.chatDocumentPath));
            const state = doc.data();
            if (false === doc.exists || undefined === state) {
                return Promise.reject(new ChatError_1.ChatError("not-found", true, "Chat not found"));
            }
            if (status !== state.status || command.dispatchId !== state.dispatchId) {
                return Promise.reject(new ChatError_1.ChatError("failed-precondition", true, "Chat status conflict"));
            }
            return block(tx, state);
        });
    }
    async updateIfChecked(status, command, block) {
        let newState = undefined;
        try {
            newState = await this.updateWithCheck(status, command, block);
        }
        catch (e) {
            logging_1.logger.w("Error updating chat due to invalid state (possible concurrent update)", e);
        }
        return newState;
    }
    async processWithCheck(status, command, block) {
        logging_1.logger.d(`Processing command: ${command.type}, runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        const run = this.updateWithCheck(status, command, (tx, state) => {
            const newState = Object.assign(Object.assign({}, state), { status: "processing" });
            tx.set(this.db.doc(command.chatDocumentPath), Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }));
            return newState;
        });
        let state;
        try {
            state = await run;
        }
        catch (e) {
            logging_1.logger.w("Precondition error", e);
            return;
        }
        try {
            await block(state);
        }
        catch (e) {
            logging_1.logger.e("Processing error", e);
            await this.db.doc(command.chatDocumentPath).set({ status: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
    }
}
exports.ChatWorker = ChatWorker;
//# sourceMappingURL=ChatWorker.js.map