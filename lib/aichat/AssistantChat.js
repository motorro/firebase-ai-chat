"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantChat = void 0;
const firebase_admin_1 = require("firebase-admin");
const logging_1 = require("../logging");
const Collections_1 = require("./data/Collections");
const https_1 = require("firebase-functions/v2/https");
var FieldValue = firebase_admin_1.firestore.FieldValue;
/**
 * Close command delay to settle down AI runs
 */
const SCHEDULE_CLOSE_AFTER = 3 * 60;
/**
 * Front-facing assistant chat
 * Runs AI chat saving state in the database
 * Clients get updates using subscriptions to document and collections
 * - Create - creates new chat
 * - Post message - posts message from client
 * - Close - closes chat
 * Functions post commands to processing table and complete ASAP
 */
class AssistantChat {
    /**
     * Constructor
     * @param db Firestore
     * @param queueName Command queue name to dispatch commands
     * @param scheduler Task scheduler
     */
    constructor(db, queueName, scheduler) {
        this.db = db;
        this.name = queueName;
        this.scheduler = scheduler;
    }
    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantId Assistant ID
     * @param dispatcherId Dispatcher ID to use for tool calls
     * @param messages Starting messages
     */
    async create(document, userId, data, assistantId, dispatcherId, messages) {
        logging_1.logger.d(`Creating new chat with assistant ${assistantId}...`);
        const batch = this.db.batch();
        const status = "processing";
        const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc();
        batch.set(document, {
            userId: userId,
            config: {
                assistantId: assistantId,
                workerName: this.name,
                dispatcherId: dispatcherId
            },
            status: status,
            latestDispatchId: dispatchDoc.id,
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        batch.set(dispatchDoc, {
            createdAt: FieldValue.serverTimestamp()
        });
        await batch.commit();
        let actions = ["create", "switchToUserInput"];
        if (undefined !== messages && messages.length > 0) {
            await this.insertMessages(document, userId, dispatchDoc.id, messages);
            actions = ["create", "post", "run", "retrieve", "switchToUserInput"];
        }
        const command = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            actions: actions
        };
        await this.scheduler.schedule(this.name, command);
        return {
            status: status,
            data: data
        };
    }
    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     */
    async postMessage(document, userId, messages) {
        logging_1.logger.d("Posting user messages to: ", document.path);
        return this.prepareDispatchWithChecks(document, userId, (current) => ["userInput"].includes(current), "processing", async (state) => {
            await this.insertMessages(document, userId, state.latestDispatchId, messages);
            const command = {
                ownerId: userId,
                chatDocumentPath: document.path,
                dispatchId: state.latestDispatchId,
                actions: ["post", "run", "retrieve", "switchToUserInput"]
            };
            await this.scheduler.schedule(this.name, command);
            return {
                status: state.status,
                data: state.data
            };
        });
    }
    /**
     * Adds user messages
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @private
     */
    async insertMessages(document, userId, dispatchId, messages) {
        const messageList = document.collection(Collections_1.Collections.messages);
        const batch = this.db.batch();
        messages.forEach((message, index) => {
            batch.create(messageList.doc(), {
                userId: userId,
                dispatchId: dispatchId,
                author: "user",
                text: message,
                inBatchSortIndex: index,
                createdAt: FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
    }
    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    async closeChat(document, userId) {
        return this.prepareDispatchWithChecks(document, userId, (current) => false === ["closing", "complete", "failed"].includes(current), "closing", async (state) => {
            logging_1.logger.d("Closing chat: ", document.path);
            const command = {
                ownerId: userId,
                chatDocumentPath: document.path,
                dispatchId: state.latestDispatchId,
                actions: ["close"]
            };
            await this.scheduler.schedule(this.name, command, {
                scheduleDelaySeconds: SCHEDULE_CLOSE_AFTER
            });
            return {
                status: state.status,
                data: state.data
            };
        });
    }
    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param checkStatus Checks current status for availability
     * @param targetStatus Target status
     * @param block Block to run
     * @private
     */
    async prepareDispatchWithChecks(document, userId, checkStatus, targetStatus, block) {
        const run = this.db.runTransaction(async (tx) => {
            const doc = await tx.get(document);
            const state = doc.data();
            if (false === doc.exists || undefined === state) {
                logging_1.logger.w("Chat not found", document.path);
                return Promise.reject(new https_1.HttpsError("not-found", "Chat not found"));
            }
            if (userId !== state.userId) {
                logging_1.logger.w("Access denied to:", userId);
                return Promise.reject(new https_1.HttpsError("permission-denied", "Access denied"));
            }
            const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc();
            tx.set(dispatchDoc, { createdAt: FieldValue.serverTimestamp() });
            if (false === checkStatus(state.status)) {
                logging_1.logger.w(`Chat is in invalid state ${state.status}`);
                return Promise.reject(new https_1.HttpsError("failed-precondition", "Can't perform this operation due to current chat state"));
            }
            const newState = Object.assign(Object.assign({}, state), { status: targetStatus, latestDispatchId: dispatchDoc.id });
            tx.set(document, Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }));
            return newState;
        });
        const state = await run;
        return await block(state);
    }
}
exports.AssistantChat = AssistantChat;
//# sourceMappingURL=AssistantChat.js.map