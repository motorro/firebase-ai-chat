"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandOverDelegate = void 0;
const crypto_1 = require("crypto");
const Collections_1 = require("../data/Collections");
const CommandScheduler_1 = require("../CommandScheduler");
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
var FieldValue = firebase_admin_1.firestore.FieldValue;
const logging_1 = require("../../logging");
const https_1 = require("firebase-functions/v2/https");
const logger = (0, logging_1.tagLogger)("HandOver");
class HandOverDelegate {
    constructor(db, schedulers) {
        this.db = db;
        this.schedulers = schedulers;
    }
    async handOver(tx, chatDocument, chatState, data) {
        logger.d(`Hand-over for: ${"string" === typeof chatDocument ? chatDocument : chatDocument.path}`, JSON.stringify(data));
        const chatDoc = "string" === typeof chatDocument ? this.db.doc(chatDocument) : chatDocument;
        const sessionId = (0, crypto_1.randomUUID)();
        const now = Timestamp.now();
        const stackEntry = Object.assign({ config: chatState.config, createdAt: now, meta: chatState.meta }, (chatState.sessionId ? { sessionId: chatState.sessionId } : {}));
        tx.set(chatDoc.collection(Collections_1.Collections.contextStack).doc(), stackEntry);
        const newState = Object.assign(Object.assign({}, chatState), { config: Object.assign(Object.assign({}, chatState.config), { assistantConfig: data.config }), status: "processing", meta: data.chatMeta || null, sessionId: sessionId, updatedAt: FieldValue.serverTimestamp() });
        tx.set(chatDoc, newState);
        const scheduler = (0, CommandScheduler_1.getScheduler)(this.schedulers, data.config);
        const command = {
            ownerId: chatState.userId,
            chatDocumentPath: "string" === typeof chatDocument ? chatDocument : chatDocument.path,
            dispatchId: chatState.latestDispatchId,
            meta: data.workerMeta || null
        };
        await scheduler.handOver(command, data.messages || []);
        return Object.assign({ formerAssistantConfig: chatState.config.assistantConfig, formerChatMeta: chatState.meta }, (chatState.sessionId ? { formerSessionId: chatState.sessionId } : {}));
    }
    async handBack(tx, chatDocument, chatState, messages, workerMeta) {
        logger.d(`Hand-back for: ${"string" === typeof chatDocument ? chatDocument : chatDocument.path}`);
        const chatDoc = "string" === typeof chatDocument ? this.db.doc(chatDocument) : chatDocument;
        const stackEntryQuery = chatDoc.collection(Collections_1.Collections.contextStack)
            .orderBy("createdAt", "desc")
            .limit(1);
        const stackEntry = (await tx.get(stackEntryQuery)).docs[0];
        const stackEntryData = stackEntry === null || stackEntry === void 0 ? void 0 : stackEntry.data();
        if (undefined === stackEntry || undefined === stackEntryData) {
            logger.w("No state to pop while trying to hand-back");
            return Promise.reject(new https_1.HttpsError("failed-precondition", "No state to pop"));
        }
        logger.d("Handing back to:", JSON.stringify(stackEntry));
        const newStatus = undefined !== messages && 0 !== messages.length ? "processing" : "userInput";
        const newState = Object.assign(Object.assign(Object.assign(Object.assign({}, chatState), { config: stackEntryData.config, status: newStatus, meta: stackEntryData.meta }), (stackEntryData.sessionId ? { sessionId: stackEntryData.sessionId } : {})), { updatedAt: FieldValue.serverTimestamp() });
        tx.set(chatDoc, newState);
        tx.delete(stackEntry.ref);
        if (undefined !== messages && 0 !== (messages === null || messages === void 0 ? void 0 : messages.length)) {
            const scheduler = (0, CommandScheduler_1.getScheduler)(this.schedulers, stackEntryData.config.assistantConfig);
            const command = {
                ownerId: chatState.userId,
                chatDocumentPath: "string" === typeof chatDocument ? chatDocument : chatDocument.path,
                dispatchId: chatState.latestDispatchId,
                meta: workerMeta || null
            };
            await scheduler.handOver(command, messages);
        }
        return Object.assign({ formerAssistantConfig: chatState.config.assistantConfig, formerChatMeta: chatState.meta }, (chatState.sessionId ? { formerSessionId: chatState.sessionId } : {}));
    }
}
exports.HandOverDelegate = HandOverDelegate;
//# sourceMappingURL=handOver.js.map