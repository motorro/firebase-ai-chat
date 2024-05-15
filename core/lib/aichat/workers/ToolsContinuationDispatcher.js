"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsContinuationDispatcherImpl = void 0;
const Continuation_1 = require("../data/Continuation");
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
class ToolsContinuationDispatcherImpl {
    /**
     * Constructor
     * @param commonData Common command data
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @return Tool calls continuation with at-once processed data or suspended
     */
    constructor(commonData, dispatcherId, db, dispatchRunner) {
        this.commonData = commonData;
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(commonData.chatDocumentPath);
        this.db = db;
        this.dispatchRunner = dispatchRunner;
    }
    async dispatch(soFar, toolCalls, meta) {
        logging_1.logger.d("Dispatching tool calls:", JSON.stringify(toolCalls));
        const continuationDocument = this.chatDocument.collection(Collections_1.Collections.continuations).doc();
        const toolCallsCollection = continuationDocument.collection(Collections_1.Collections.toolCalls);
        let continuation = {
            dispatcherId: this.dispatcherId,
            data: soFar,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            meta: meta
        };
        const dispatched = await this.dispatchRunner.dispatch(this.commonData, [continuationDocument, continuation], toolCalls.map((it, index) => [
            toolCallsCollection.doc(),
            { index: index, call: { request: it, response: null } }
        ]));
        continuation = Object.assign(Object.assign({}, continuation), { data: dispatched.data });
        // If all processed without suspension - return at once
        const result = [];
        let suspended = false;
        for (const [_id, call] of dispatched.tools) {
            if (null != call.call.response) {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: call.call.response
                });
            }
            else {
                suspended = true;
                break;
            }
        }
        if (false === suspended) {
            logging_1.logger.d("All tools resolved. Returning...");
            return Continuation_1.Continuation.resolve({
                data: dispatched.data,
                responses: result,
                meta: continuation.meta
            });
        }
        const batch = this.db.batch();
        batch.set(continuationDocument, { data: dispatched.data }, { merge: true });
        dispatched.tools.forEach(([ref, call]) => {
            batch.set(ref, call);
        });
        await batch.commit();
        return Continuation_1.Continuation.suspend();
    }
}
exports.ToolsContinuationDispatcherImpl = ToolsContinuationDispatcherImpl;
//# sourceMappingURL=ToolsContinuationDispatcher.js.map