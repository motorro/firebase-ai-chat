"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsContinuationDispatcherImpl = void 0;
exports.hasHandOver = hasHandOver;
const Continuation_1 = require("../data/Continuation");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const firebase_admin_1 = require("firebase-admin");
const ChatError_1 = require("../data/ChatError");
var Timestamp = firebase_admin_1.firestore.Timestamp;
var FieldValue = firebase_admin_1.firestore.FieldValue;
const logger = (0, logging_1.tagLogger)("ToolsContinuationDispatcher");
function hasHandOver(data) {
    return "data" in data && "handOver" in data;
}
/**
 * Continuation dispatcher implementation
 */
class ToolsContinuationDispatcherImpl {
    /**
     * Constructor
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @param logData If true - logs data state
     * and thus fails continuation
     */
    constructor(chatDocumentPath, dispatcherId, db, dispatchRunner, logData = false) {
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(chatDocumentPath);
        this.db = db;
        this.dispatchRunner = dispatchRunner;
        this.logData = logData;
    }
    async dispatch(soFar, toolCalls, updateChatData, dispatchControl) {
        logger.d("Dispatching tool calls");
        if (this.logData) {
            (0, logging_1.tagLogger)("DATA").d("Data so far: ", JSON.stringify(soFar));
        }
        const continuationDocument = this.chatDocument.collection(Collections_1.Collections.continuations).doc();
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = {
            dispatcherId: this.dispatcherId,
            state: "suspended",
            handOver: hasHandOver(soFar) ? soFar.handOver : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        const tools = [];
        const batch = this.db.batch();
        // Pre-set data as doDispatch merges updates
        batch.set(continuationDocument, continuation);
        toolCalls.forEach((it, index) => {
            const doc = toolCallsCollection.doc();
            const tool = { index: index, call: { request: it, response: null } };
            tools.push([doc, tool]);
            batch.set(doc, tool);
        });
        const result = await this.doDispatch(batch, updateChatData, continuationDocument, hasHandOver(soFar) ? soFar.data : soFar, continuation, tools, dispatchControl);
        // Save only if suspended
        if (result.isSuspended()) {
            logger.d("Saving continuation to:", continuationDocument.path);
            await batch.commit();
        }
        return result;
    }
    async dispatchCommand(soFar, command, updateChatData, dispatchControl) {
        logger.d("Continuation processing. Moving forward:", JSON.stringify(command));
        if (this.logData) {
            (0, logging_1.tagLogger)("DATA").d("Data so far: ", JSON.stringify(soFar));
        }
        // eslint-disable-next-line max-len
        const continuationDocument = this.chatDocument.collection(Collections_1.Collections.continuations).doc(command.continuation.continuationId);
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError_1.ChatError("not-found", true, "Continuation data not found"));
        }
        const toolCallData = (await toolCallsCollection.orderBy("index").get()).docs;
        const toolCalls = [];
        toolCallData.forEach((it) => {
            const data = it.data();
            if (undefined !== data) {
                toolCalls.push([it.ref, data]);
            }
        });
        const batch = this.db.batch();
        const result = await this.doDispatch(batch, updateChatData, continuationDocument, soFar, continuation, toolCalls, dispatchControl);
        logger.d("Saving continuation to:", continuationDocument.path);
        await batch.commit();
        return result;
    }
    async doDispatch(batch, updateChatData, continuationDoc, soFar, continuation, toolCalls, dispatchControl) {
        const dispatched = await this.dispatchRunner.dispatch(soFar, continuation, toolCalls, await this.getChatData(), {
            getContinuationCommand: (continuationToolCall) => dispatchControl.getContinuationCommand({
                continuationId: continuationDoc.id,
                tool: continuationToolCall
            })
        });
        const result = [];
        for (let i = 0; i < dispatched.tools.length; i++) {
            const [id, call] = dispatched.tools[i];
            const response = call.call.response;
            if (null !== response) {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: response
                });
                // Update if processed
                if (null === toolCalls[i][1].call.response) {
                    batch.set(id, { call: { response: response } }, { merge: true });
                }
            }
        }
        batch.set(continuationDoc, {
            state: dispatched.suspended ? "suspended" : "resolved",
            handOver: dispatched.handOver,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        if (this.logData) {
            (0, logging_1.tagLogger)("DATA").d("Saving chat data: ", JSON.stringify(dispatched.data));
        }
        await updateChatData(dispatched.data);
        if (dispatched.suspended) {
            logger.d("Dispatch suspended");
            return Continuation_1.Continuation.suspend();
        }
        else {
            logger.d("Dispatch resolved");
            return Continuation_1.Continuation.resolve({
                data: dispatched.data,
                handOver: dispatched.handOver,
                responses: result
            });
        }
    }
    async getChatData() {
        const chat = (await this.chatDocument.get()).data();
        if (undefined === chat) {
            return Promise.reject(new ChatError_1.ChatError("not-found", true, "Chat not found"));
        }
        return {
            ownerId: chat.userId,
            chatDocumentPath: this.chatDocument.path,
            dispatchId: chat.latestDispatchId,
            sessionId: chat.sessionId || null,
            assistantConfig: chat.config.assistantConfig,
            meta: chat.meta
        };
    }
}
exports.ToolsContinuationDispatcherImpl = ToolsContinuationDispatcherImpl;
//# sourceMappingURL=ToolsContinuationDispatcher.js.map