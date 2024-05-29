"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolContinuationWorker = void 0;
const BaseChatWorker_1 = require("./BaseChatWorker");
const ContinuationCommand_1 = require("../data/ContinuationCommand");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const ChatError_1 = require("../data/ChatError");
class ToolContinuationWorker extends BaseChatWorker_1.BaseChatWorker {
    constructor(isSupportedMeta, onResolved, firestore, scheduler, dispatchRunner) {
        super(firestore, scheduler);
        this.isSupportedMeta = isSupportedMeta;
        this.onResolved = onResolved;
        this.dispatchRunner = dispatchRunner;
    }
    isSupportedCommand(req) {
        return (0, ContinuationCommand_1.isContinuationCommandRequest)(req, this.isSupportedMeta);
    }
    async doDispatch(action, data, _state, control) {
        logging_1.logger.d("Continuation processing. Moving forward:", JSON.stringify(action), JSON.stringify(data));
        const continuationDocument = this.db.doc(data.chatDocumentPath).collection(Collections_1.Collections.continuations).doc(action.continuationId);
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logging_1.logger.w("Continuation data not found");
            return Promise.reject(new ChatError_1.ChatError("not-found", true, "Continuation data not found"));
        }
        const toolCallData = (await toolCallsCollection.orderBy("index").get()).docs;
        const processedCalls = [];
        const unprocessedCalls = [];
        toolCallData.forEach((it) => {
            const data = it.data();
            if (undefined !== data) {
                if (null != data.call.response) {
                    processedCalls.push([it.ref, data]);
                }
                else {
                    unprocessedCalls.push([it.ref, data]);
                }
            }
        });
        const result = [];
        let hasUpdates = false;
        let suspended = false;
        let dataSoFar = continuation.data;
        if (0 !== unprocessedCalls.length) {
            const dispatched = await this.dispatchRunner.dispatch(data, [continuationDocument, continuation], unprocessedCalls);
            // If all processed without suspension - return at once
            const batch = this.db.batch();
            for (const [id, call] of dispatched.tools) {
                if (null != call.call.response) {
                    result.push({
                        toolCallId: call.call.request.toolCallId,
                        toolName: call.call.request.toolName,
                        response: call.call.response
                    });
                    batch.set(id, Object.assign({}, call));
                    hasUpdates = true;
                }
                else {
                    logging_1.logger.d("Suspended at:", JSON.stringify(call));
                    suspended = true;
                    break;
                }
            }
            if (hasUpdates) {
                dataSoFar = dispatched.data;
                batch.set(continuationDocument, { data: dataSoFar }, { merge: true });
                await batch.commit();
            }
        }
        if (false === suspended) {
            logging_1.logger.d("All tools resolved. Returning...");
            processedCalls.forEach(([_id, call]) => {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: call.call.response
                });
            });
            await this.onResolved(data, {
                data: dataSoFar,
                responses: result,
                meta: action.continuationMeta
            }, control.updateChatState);
        }
    }
}
exports.ToolContinuationWorker = ToolContinuationWorker;
//# sourceMappingURL=ToolContinuationWorker.js.map