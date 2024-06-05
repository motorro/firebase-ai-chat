"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsContinuationDispatcherImpl = void 0;
const Continuation_1 = require("../data/Continuation");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
const ChatError_1 = require("../data/ChatError");
var FieldValue = firebase_admin_1.firestore.FieldValue;
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
     * and thus fails continuation
     */
    constructor(chatDocumentPath, dispatcherId, db, dispatchRunner) {
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(chatDocumentPath);
        this.db = db;
        this.dispatchRunner = dispatchRunner;
    }
    async dispatch(soFar, toolCalls, getContinuationCommand) {
        logging_1.logger.d("Dispatching tool calls");
        const continuationDocument = this.chatDocument.collection(Collections_1.Collections.continuations).doc();
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = {
            dispatcherId: this.dispatcherId,
            state: "suspended",
            data: soFar,
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
        const result = await this.doDispatch(batch, continuationDocument, continuation, tools, getContinuationCommand);
        // Save only if suspended
        if (result.isSuspended()) {
            logging_1.logger.d("Saving continuation to:", continuationDocument.path);
            await batch.commit();
        }
        return result;
    }
    async dispatchCommand(command, getContinuationCommand) {
        logging_1.logger.d("Continuation processing. Moving forward:", JSON.stringify(command));
        // eslint-disable-next-line max-len
        const continuationDocument = this.chatDocument.collection(Collections_1.Collections.continuations).doc(command.continuation.continuationId);
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logging_1.logger.w("Continuation data not found");
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
        const result = await this.doDispatch(batch, continuationDocument, continuation, toolCalls, getContinuationCommand);
        logging_1.logger.d("Saving continuation to:", continuationDocument.path);
        await batch.commit();
        return result;
    }
    async doDispatch(batch, continuationDoc, continuation, toolCalls, getContinuationCommand) {
        const dispatched = await this.dispatchRunner.dispatch(continuation, toolCalls, await this.getChatData(), (continuationToolCall) => getContinuationCommand({
            continuationId: continuationDoc.id,
            tool: continuationToolCall
        }));
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
            data: dispatched.data,
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        if (dispatched.suspended) {
            logging_1.logger.d("Dispatch suspened");
            return Continuation_1.Continuation.suspend();
        }
        else {
            logging_1.logger.d("Dispatch resolved");
            return Continuation_1.Continuation.resolve({
                data: dispatched.data,
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
            assistantConfig: chat.config.assistantConfig,
            meta: chat.meta
        };
    }
}
exports.ToolsContinuationDispatcherImpl = ToolsContinuationDispatcherImpl;
//# sourceMappingURL=ToolsContinuationDispatcher.js.map