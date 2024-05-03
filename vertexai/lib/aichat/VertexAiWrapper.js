"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiWrapper = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
/**
 * Wraps Open AI assistant use
 */
class VertexAiWrapper {
    /**
     * Constructor
     * @param model Pre-configured `GenerativeModel`
     * @param firestore Firebase firestore
     * @param threadsPath Threads collection path
     */
    constructor(model, firestore, threadsPath) {
        this.model = model;
        this.firestore = firestore;
        this.threads = firestore.collection(threadsPath);
    }
    /**
     * Generates system instructions
     * @param config System instructions config
     * @return System instructions content
     */
    static generateSystemInstructions(config) {
        var _a;
        const parts = [];
        parts.push({ text: "Instructions: " + config.instructions });
        let exampleNumber = 1;
        (_a = config.examples) === null || _a === void 0 ? void 0 : _a.forEach((it) => {
            parts.push({ text: (0, firebase_ai_chat_core_1.printAiExample)(it, exampleNumber) });
            ++exampleNumber;
        });
        return {
            parts: parts,
            role: "system"
        };
    }
    static isFunctionCall(part) {
        return "functionCall" in part && undefined !== part.functionCall;
    }
    /**
     * Thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @return Message collection reference
     * @private
     */
    getThreadMessageCollection(threadId) {
        return this.threads.doc(threadId).collection("history");
    }
    /**
     * Returns thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @private
     */
    async getThreadMessages(threadId) {
        return (await this.getThreadMessageCollection(threadId).orderBy("createdAt").orderBy("inBatchSortIndex").get()).docs.map((doc) => {
            return [doc.id, doc.data()];
        });
    }
    async createThread(meta) {
        firebase_ai_chat_core_1.logger.d("Creating thread. Meta:", JSON.stringify(meta));
        const doc = this.threads.doc();
        await doc.set({ meta: meta });
        return doc.id;
    }
    async postMessage(threadId, instructions, messages, dataSoFar) {
        const tools = instructions.tools;
        const params = Object.assign(Object.assign({ systemInstruction: VertexAiWrapper.generateSystemInstructions(instructions) }, (undefined !== tools ? { tools: tools.definition } : {})), { history: (await this.getThreadMessages(threadId)).map((it) => it[1].content) });
        const chat = this.model.startChat(params);
        const result = await this.doPostMessage(chat, messages.map((it) => ({
            text: it
        })), (tools === null || tools === void 0 ? void 0 : tools.dispatcher) || ((data) => Promise.resolve(data)), { data: dataSoFar, messages: [] });
        const resultMessages = [];
        const batch = this.firestore.batch();
        result.messages.forEach((threadMessage) => {
            const mDoc = this.getThreadMessageCollection(threadId).doc();
            batch.set(mDoc, threadMessage);
            if ("model" === threadMessage.content.role) {
                let message = undefined;
                threadMessage.content.parts.forEach((part) => {
                    const text = part.text;
                    if (undefined !== text) {
                        message = (message && message + "\n" + text) || text;
                    }
                });
                if (undefined !== message) {
                    resultMessages.push({
                        id: mDoc.id,
                        createdAt: threadMessage.createdAt,
                        author: "ai",
                        text: message
                    });
                }
            }
        });
        await batch.commit();
        return {
            data: result.data,
            messages: resultMessages
        };
    }
    async doPostMessage(chat, parts, dispatcher, soFar) {
        var _a, _b, _c;
        let data = soFar.data;
        let nextBatchSortIndex = ((_a = soFar.messages[soFar.messages.length - 1]) === null || _a === void 0 ? void 0 : _a.inBatchSortIndex) || 0;
        const messages = [
            ...soFar.messages,
            {
                content: {
                    role: "user",
                    parts: parts
                },
                createdAt: Timestamp.now(),
                inBatchSortIndex: ++nextBatchSortIndex
            }
        ];
        let aiResult = undefined;
        try {
            aiResult = (_c = (_b = (await chat.sendMessage(parts)).response) === null || _b === void 0 ? void 0 : _b.candidates) === null || _c === void 0 ? void 0 : _c.at(0);
        }
        catch (e) {
            firebase_ai_chat_core_1.logger.w("AI call error", e);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unavailable", false, "Error running AI", e));
        }
        if (undefined === aiResult) {
            firebase_ai_chat_core_1.logger.w("Empty AI result");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unavailable", false, "No candidates in AI answer"));
        }
        messages.push({
            content: aiResult.content,
            createdAt: Timestamp.now(),
            inBatchSortIndex: ++nextBatchSortIndex
        });
        const functionResults = [];
        for (const part of aiResult.content.parts) {
            if (VertexAiWrapper.isFunctionCall(part)) {
                let dispatchResult;
                try {
                    data = await dispatcher(data, part.functionCall.name, part.functionCall.args);
                    dispatchResult = { data: data };
                }
                catch (e) {
                    firebase_ai_chat_core_1.logger.w("Error dispatching function:", e);
                    dispatchResult = (0, firebase_ai_chat_core_1.getDispatchError)(e);
                }
                functionResults.push({
                    functionResponse: {
                        name: part.functionCall.name,
                        response: dispatchResult
                    }
                });
            }
        }
        if (0 !== functionResults.length) {
            return await this.doPostMessage(chat, functionResults, dispatcher, { data: data, messages: messages });
        }
        return { data: data, messages: messages };
    }
    async deleteThread(threadId) {
        await this.firestore.recursiveDelete(this.threads.doc(threadId));
    }
}
exports.VertexAiWrapper = VertexAiWrapper;
//# sourceMappingURL=VertexAiWrapper.js.map