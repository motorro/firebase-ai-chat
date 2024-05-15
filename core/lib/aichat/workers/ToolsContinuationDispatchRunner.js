"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolsContinuationDispatchRunner = void 0;
const ToolsDispatcher_1 = require("../ToolsDispatcher");
const logging_1 = require("../../logging");
const ChatError_1 = require("../data/ChatError");
class ToolsContinuationDispatchRunner {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    constructor(dispatchers) {
        this.dispatchers = dispatchers;
    }
    async dispatch(commonData, continuation, tools) {
        let [continuationDoc, continuationData] = continuation;
        let suspended = false;
        let currentData = continuationData.data;
        const dispatchedTools = [];
        for (const [callId, callData] of tools) {
            if (suspended || null != callData.call.response) {
                pushResult(callId, callData);
                continue;
            }
            logging_1.logger.d("Running tool:", callData.call.request.toolName);
            logging_1.logger.d("Data so far:", currentData);
            logging_1.logger.d("Arguments:", JSON.stringify(callData.call.request.args));
            const continuationCommand = {
                commonData: commonData,
                actionData: {
                    continuationId: continuationDoc.id,
                    responseId: callId.id,
                    continuationMeta: continuationData.meta
                }
            };
            let result = await (0, ToolsDispatcher_1.dispatchToContinuation)(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(currentData, callData.call.request.toolName, callData.call.request.args, continuationCommand);
            });
            // Remove if running parallel
            if (result.isSuspended()) {
                logging_1.logger.d("Suspended...");
                suspended = true;
                break;
            }
            pushResult(callId, Object.assign(Object.assign({}, callData), { call: Object.assign(Object.assign({}, callData.call), { response: result.value }) }));
            function pushResult(id, call) {
                dispatchedTools.push([callId, callData]);
                const response = callData.call.response;
                if (null != response && (0, ToolsDispatcher_1.isDispatchSuccess)(response)) {
                    currentData = response.data;
                }
            }
        }
        return { data: currentData, tools: dispatchedTools };
    }
    getDispatcher(dispatcherId) {
        let dispatcher = this.dispatchers[dispatcherId];
        if (undefined === dispatcher) {
            logging_1.logger.w("Dispatcher not found:", dispatcherId);
            throw new ChatError_1.ChatError("unimplemented", true, "Dispatcher not found:", dispatcherId);
        }
        return dispatcher;
    }
}
exports.ToolsContinuationDispatchRunner = ToolsContinuationDispatchRunner;
//# sourceMappingURL=ToolsContinuationDispatchRunner.js.map