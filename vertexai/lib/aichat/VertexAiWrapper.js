"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAiWrapper = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
const logger = (0, firebase_ai_chat_core_1.tagLogger)("VertexAiWrapper");
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
     * Sometimes Gemini creates a call with faulty data:
     * '{"functionCall":{"args":{"value":25}}}'
     * @param part Part to check
     * @return True if part is a function call
     * @private
     */
    static checkFunctionCall(part) {
        if (undefined === part.functionCall.name) {
            logger.w("Function call error: no function name in call:", JSON.stringify(part));
            return { error: "You didn't supply a function name. Check tools definition and supply a function name!" };
        }
        return undefined;
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
        logger.d("Creating thread. Meta:", JSON.stringify(meta));
        const doc = this.threads.doc();
        await doc.set({ meta: meta });
        return doc.id;
    }
    async postMessage(threadId, instructions, messages, dataSoFar, dispatch) {
        logger.d("Posting messages...");
        return await this.doPost(threadId, instructions, messages.map((it) => ({
            text: it
        })), dataSoFar, dispatch);
    }
    /**
     * Maintains conversation data
     * @param threadId Thread ID
     * @param instructions Instructions
     * @param parts Parts to post
     * @param dataSoFar Data so far
     * @param dispatch Dispatch function
     * @return Post result
     * @private
     */
    async doPost(threadId, instructions, parts, dataSoFar, dispatch) {
        const tools = instructions.tools;
        const params = Object.assign(Object.assign({ systemInstruction: VertexAiWrapper.generateSystemInstructions(instructions) }, (undefined !== tools ? { tools: tools.definition } : {})), { history: (await this.getThreadMessages(threadId)).map((it) => it[1].content) });
        const chat = this.model.startChat(params);
        const result = await this.run(chat, parts, { data: dataSoFar, messages: [] }, dispatch);
        const { data: stateData, messages: stateMessages } = result.state;
        const resultMessages = [];
        const batch = this.firestore.batch();
        stateMessages.forEach((threadMessage) => {
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
        if (false === result.suspended) {
            return firebase_ai_chat_core_1.Continuation.resolve({
                data: stateData,
                messages: resultMessages
            });
        }
        return firebase_ai_chat_core_1.Continuation.suspend();
    }
    processToolsResponse(threadId, instructions, request, dataSoFar, dispatch) {
        return this.doPost(threadId, instructions, request.toolsResult.map((it) => ({
            functionResponse: {
                name: it.toolName,
                response: it.response
            }
        })), dataSoFar, dispatch);
    }
    /**
     * Runs AI
     * @param chat Chat session
     * @param parts Parts to provide
     * @param soFar Data so far
     * @param dispatch Dispatching function
     * @return Inter-run session state
     * @private
     */
    async run(chat, parts, soFar, dispatch) {
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
        /**
         * Runs tools
         * @param toolCalls Tool calls
         * @return Next state
         */
        const runTools = async (toolCalls) => {
            if (0 === toolCalls.length) {
                return { suspended: false, state: { data: data, messages: messages } };
            }
            logger.d("Dispatching tools...");
            // Gemini misses function names from time to time
            let nameErrorIn = -1;
            let nameError = undefined;
            for (let i = 0; i < toolCalls.length; ++i) {
                if (nameErrorIn < 0) {
                    const checkError = VertexAiWrapper.checkFunctionCall(toolCalls[i]);
                    if (undefined !== checkError) {
                        nameErrorIn = i;
                        nameError = checkError;
                    }
                    break;
                }
            }
            if (nameErrorIn >= 0 && undefined !== nameError) {
                logger.w(`Empty function name in part ${nameErrorIn}`);
                const thisError = nameError;
                const otherError = {
                    error: `Function call was not done because you didn't provide a function name in part with index ${nameErrorIn}!`
                };
                return await this.run(chat, toolCalls.map((it, index) => ({
                    functionResponse: {
                        name: it.functionCall.name || "function name was not provided",
                        response: index === nameErrorIn ? thisError : otherError
                    }
                })), { data: data, messages: messages }, dispatch);
            }
            const result = await dispatch(data, toolCalls.map((part) => ({
                toolCallId: part.functionCall.name,
                toolName: part.functionCall.name,
                soFar: data,
                args: part.functionCall.args
            })));
            if (result.isResolved()) {
                logger.d("All tools dispatched");
                data = result.value.data;
                return await this.run(chat, result.value.responses.map((it) => ({
                    functionResponse: {
                        name: it.toolName,
                        response: it.response
                    }
                })), { data: result.value.data, messages: messages }, dispatch);
            }
            else {
                logger.d("Some tools suspended...");
                return { suspended: true, state: { data: data, messages: messages } };
            }
        };
        let aiResult = undefined;
        try {
            aiResult = (_c = (_b = (await chat.sendMessage(parts)).response) === null || _b === void 0 ? void 0 : _b.candidates) === null || _c === void 0 ? void 0 : _c.at(0);
        }
        catch (e) {
            logger.w("AI call error", e);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unavailable", false, "Error running AI", e));
        }
        if (undefined === aiResult) {
            logger.w("Empty AI result");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unavailable", false, "No candidates in AI answer"));
        }
        messages.push({
            content: aiResult.content,
            createdAt: Timestamp.now(),
            inBatchSortIndex: ++nextBatchSortIndex
        });
        const functionCalls = aiResult.content.parts.filter(VertexAiWrapper.isFunctionCall);
        if (0 !== functionCalls.length) {
            return runTools(functionCalls);
        }
        return { suspended: false, state: { data: data, messages: messages } };
    }
    async deleteThread(threadId) {
        await this.firestore.recursiveDelete(this.threads.doc(threadId));
    }
}
exports.VertexAiWrapper = VertexAiWrapper;
//# sourceMappingURL=VertexAiWrapper.js.map