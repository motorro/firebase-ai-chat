"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantChat = void 0;
const firebase_admin_1 = require("firebase-admin");
const Collections_1 = require("./data/Collections");
const https_1 = require("firebase-functions/v2/https");
const CommandScheduler_1 = require("./CommandScheduler");
var Timestamp = firebase_admin_1.firestore.Timestamp;
const logging_1 = require("../logging");
const NewMessage_1 = require("./data/NewMessage");
const crypto_1 = require("crypto");
var FieldValue = firebase_admin_1.firestore.FieldValue;
const ChatError_1 = require("./data/ChatError");
const handOver_1 = require("./chat/handOver");
const logger = (0, logging_1.tagLogger)("AssistantChat");
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
    getScheduler(config) {
        return (0, CommandScheduler_1.getScheduler)(this.schedulers, config);
    }
    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Command scheduler
     * @param cleaner Chat cleaner
     */
    constructor(db, scheduler, cleaner) {
        this.db = db;
        this.schedulers = Array.isArray(scheduler) ? scheduler : [scheduler];
        this.cleaner = cleaner;
    }
    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantConfig Assistant Config
     * @param messages Starting messages
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Metadata saved to chat state
     */
    async create(document, userId, data, assistantConfig, messages, workerMeta, chatMeta) {
        logger.d("Creating new chat with assistant:", JSON.stringify(assistantConfig));
        const status = "processing";
        const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc();
        const sessionId = (0, crypto_1.randomUUID)();
        const action = await this.db.runTransaction(async (tx) => {
            tx.set(document, {
                userId: userId,
                config: {
                    assistantConfig: assistantConfig
                },
                status: status,
                sessionId: sessionId,
                latestDispatchId: dispatchDoc.id,
                data: data,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                meta: chatMeta || null
            });
            tx.set(dispatchDoc, {
                createdAt: FieldValue.serverTimestamp()
            });
            const scheduler = this.getScheduler(assistantConfig);
            if (undefined !== messages && messages.length > 0) {
                this.insertMessages(tx, document, userId, dispatchDoc.id, messages, sessionId, chatMeta === null || chatMeta === void 0 ? void 0 : chatMeta.userMessageMeta);
                return async (common) => {
                    await scheduler.createAndRun(common);
                };
            }
            return async (common) => {
                await scheduler.create(common);
            };
        });
        const command = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: workerMeta || null
        };
        await action(command);
        return {
            status: status,
            data: data
        };
    }
    /**
     * Runs AI once and cleans up afterward
     * For tasks like analyzing some text once and getting results with function call
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantConfig Assistant Config
     * @param messages Starting messages
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Metadata saved to chat state
     * @return Chat state update
     */
    async singleRun(document, userId, data, assistantConfig, messages, workerMeta, chatMeta) {
        logger.d("Creating new single run with assistant:", JSON.stringify(assistantConfig));
        const status = "processing";
        const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc();
        const sessionId = (0, crypto_1.randomUUID)();
        await this.db.runTransaction(async (tx) => {
            tx.set(document, {
                userId: userId,
                config: {
                    assistantConfig: assistantConfig
                },
                status: status,
                sessionId: sessionId,
                latestDispatchId: dispatchDoc.id,
                data: data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                meta: chatMeta || null
            });
            tx.set(dispatchDoc, {
                createdAt: Timestamp.now()
            });
            this.insertMessages(tx, document, userId, dispatchDoc.id, messages, sessionId, chatMeta === null || chatMeta === void 0 ? void 0 : chatMeta.userMessageMeta);
        });
        const command = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: workerMeta || null
        };
        await this.getScheduler(assistantConfig).singleRun(command);
        return {
            status: status,
            data: data
        };
    }
    /**
     * Hands over chat to another assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param assistantConfig Assistant Config
     * @param handOverMessages Messages used to initialize the new chat passed (hidden from user)
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Chat meta to set for switched chat
     * @return Chat stack update
     */
    async handOver(document, userId, assistantConfig, handOverMessages, workerMeta, chatMeta) {
        logger.d("Handing over chat: ", document.path);
        return await this.prepareDispatchWithChecks(document, userId, (current) => ["userInput"].includes(current), async (tx, state) => {
            const delegate = new handOver_1.HandOverDelegate(this.db, this.schedulers);
            return await delegate.handOver(tx, document, state, {
                config: assistantConfig,
                messages: handOverMessages,
                chatMeta: chatMeta,
                workerMeta: workerMeta
            });
        });
    }
    /**
     * Hands chat back to the next popped assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param handOverMessages Messages used to sent when handing back (hidden from user)
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat stack update
     */
    async handBack(document, userId, handOverMessages, workerMeta) {
        logger.d("Popping chat state: ", document.path);
        return await this.prepareDispatchWithChecks(document, userId, (current) => ["userInput"].includes(current), async (tx, state) => {
            const delegate = new handOver_1.HandOverDelegate(this.db, this.schedulers);
            return await delegate.handBack(tx, document, state, handOverMessages, workerMeta);
        });
    }
    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat state update
     */
    async postMessage(document, userId, messages, workerMeta) {
        logger.d("Posting user messages to: ", document.path);
        const state = await this.prepareDispatchWithChecks(document, userId, (current) => ["userInput"].includes(current), async (tx, state, updateState) => {
            var _a;
            updateState({ status: "processing" });
            this.insertMessages(tx, document, userId, state.latestDispatchId, messages, state.sessionId, (_a = state.meta) === null || _a === void 0 ? void 0 : _a.userMessageMeta);
            return state;
        });
        const newData = (await document.get()).data();
        if (undefined === newData) {
            throw new ChatError_1.ChatError("not-found", true, "Chat not found");
        }
        const command = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: state.latestDispatchId,
            meta: workerMeta || null
        };
        await this.getScheduler(state.config.assistantConfig).postAndRun(command);
        return {
            data: state.data,
            status: "processing"
        };
    }
    /**
     * Adds user messages
     * @param batch Write batch
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @param sessionId Chat session ID
     * @param chatMeta Common message meta
     * @private
     */
    insertMessages(batch, document, userId, dispatchId, messages, sessionId, chatMeta) {
        const messageList = document.collection(Collections_1.Collections.messages);
        const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc(dispatchId);
        let nextIndex = 0;
        messages.forEach((message) => {
            let text;
            let meta = chatMeta || null;
            let data = null;
            if ((0, NewMessage_1.isStructuredMessage)(message)) {
                text = message.text;
                if (message.meta) {
                    if (null != meta) {
                        meta = Object.assign(Object.assign({}, meta), message.meta);
                    }
                    else {
                        meta = message.meta;
                    }
                }
                if (message.data) {
                    data = message.data;
                }
            }
            else {
                text = String(message);
            }
            batch.create(messageList.doc(), Object.assign({ userId: userId, dispatchId: dispatchId, author: "user", text: text, data: data, inBatchSortIndex: nextIndex, createdAt: Timestamp.now(), meta: meta }, (sessionId ? { sessionId: sessionId } : {})));
            ++nextIndex;
        });
        batch.set(dispatchDoc, { nextMessageIndex: nextIndex }, { merge: true });
    }
    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    async closeChat(document, userId) {
        const state = await this.prepareDispatchWithChecks(document, userId, (current) => false === ["closing", "complete", "failed"].includes(current), async (_tx, state, updateState) => {
            logger.d("Chat closed: ", document.path);
            updateState({ status: "complete" });
            return state;
        });
        await this.cleaner.cleanup(document.path);
        return {
            status: "complete",
            data: state.data
        };
    }
    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param checkStatus Checks current status for availability
     * @param block Block to run
     * @private
     */
    async prepareDispatchWithChecks(document, userId, checkStatus, block) {
        return await this.db.runTransaction(async (tx) => {
            const dispatchDoc = document.collection(Collections_1.Collections.dispatches).doc();
            let state = Object.assign(Object.assign({}, (await this.checkAndGetState(tx, document, userId, checkStatus))), { latestDispatchId: dispatchDoc.id });
            const result = await (block(tx, state, (update) => {
                state = Object.assign(state, update);
                tx.set(document, Object.assign(Object.assign({}, state), { updatedAt: FieldValue.serverTimestamp() }));
            }));
            tx.set(dispatchDoc, { createdAt: Timestamp.now() }, { merge: true });
            tx.set(document, { latestDispatchId: dispatchDoc.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            return result;
        });
    }
    /**
     * Retrieves chat data
     * @param tx Active transaction
     * @param document Chat document
     * @param userId Bound user ID
     * @param checkStatus Checks current status for availability
     * @return Chat state if checks are ok
     * @private
     */
    async checkAndGetState(tx, document, userId, checkStatus) {
        const doc = await tx.get(document);
        const state = doc.data();
        if (false === doc.exists || undefined === state) {
            logger.w("Chat not found", document.path);
            return Promise.reject(new https_1.HttpsError("not-found", "Chat not found"));
        }
        if (userId !== state.userId) {
            logger.w("Access denied to:", userId);
            return Promise.reject(new https_1.HttpsError("permission-denied", "Access denied"));
        }
        if (false === checkStatus(state.status)) {
            logger.w(`Chat is in invalid state ${state.status}`);
            return Promise.reject(new https_1.HttpsError("failed-precondition", "Can't perform this operation due to current chat state"));
        }
        return state;
    }
}
exports.AssistantChat = AssistantChat;
//# sourceMappingURL=AssistantChat.js.map