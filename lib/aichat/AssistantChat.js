"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantChat = void 0;
const firebase_admin_1 = require("firebase-admin");
const logging_1 = require("../logging");
const Collections_1 = require("./data/Collections");
const short_unique_id_1 = require("short-unique-id");
const https_1 = require("firebase-functions/v2/https");
var FieldValue = firebase_admin_1.firestore.FieldValue;
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
     * @param name Command dispatcher name
     * @param scheduler Task scheduler
     * @param scheduling Task scheduling
     */
    constructor(db, name, scheduler, scheduling = {}) {
        this.runIdGenerator = new short_unique_id_1.default({ length: 16 });
        this.db = db;
        this.name = name;
        this.scheduler = scheduler;
        this.scheduling = scheduling;
    }
    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantId Assistant ID
     * @param dispatcherId Dispatcher ID to use for tool calls
     */
    async create(document, userId, data, assistantId, dispatcherId) {
        logging_1.logger.d(`Creating new chat with assistant ${assistantId}...`);
        await document.set({
            userId: userId,
            config: {
                assistantId: assistantId,
                dispatcherId: dispatcherId
            },
            status: "created",
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        return {
            status: "created",
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
        return this.prepareDispatchWithChecks(document, userId, ["created", "userInput"], async (state, dispatchId) => {
            const batch = this.db.batch();
            const messageList = document.collection(Collections_1.Collections.messages);
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
            const command = {
                ownerId: userId,
                chatDocumentPath: document.path,
                dispatchId: dispatchId,
                type: "post"
            };
            await this.scheduler.schedule(this.name, command, this.scheduling);
            return {
                status: state.status,
                data: state.data
            };
        });
    }
    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    async closeChat(document, userId) {
        return this.prepareDispatchWithChecks(document, userId, ["created", "userInput", "dispatching", "processing"], async (state, dispatchId) => {
            logging_1.logger.d("Closing chat: ", document.path);
            const command = {
                ownerId: userId,
                chatDocumentPath: document.path,
                dispatchId: dispatchId,
                type: "close"
            };
            await this.scheduler.schedule(this.name, command, this.scheduling);
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
     * @param requiredStatus Allowed statuses to run block
     * @param block Block to run
     * @private
     */
    async prepareDispatchWithChecks(document, userId, requiredStatus, block) {
        const dispatchId = this.runIdGenerator.randomUUID();
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
            if (false === requiredStatus.includes(state.status)) {
                logging_1.logger.w(`Chat is in invalid state ${state.status}, required:`, requiredStatus);
                return Promise.reject(new https_1.HttpsError("failed-precondition", "Can't perform this operation due to current chat state"));
            }
            const newState = Object.assign(Object.assign({}, state), { status: "dispatching", dispatchId: dispatchId });
            tx.set(document, Object.assign(Object.assign({}, newState), { updatedAt: FieldValue.serverTimestamp() }));
            return newState;
        });
        return await block(await run, dispatchId);
    }
}
exports.AssistantChat = AssistantChat;
//# sourceMappingURL=AssistantChat.js.map