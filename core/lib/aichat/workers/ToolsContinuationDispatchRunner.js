"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonFormatContinuationError = exports.SequentialToolsContinuationDispatchRunner = void 0;
const ToolsDispatcher_1 = require("../ToolsDispatcher");
const logging_1 = require("../../logging");
const ChatError_1 = require("../data/ChatError");
/**
 * Runs passed tools sequentially suspending continuation if suspended
 * If any call fails - also fails other subsequent calls
 */
class SequentialToolsContinuationDispatchRunner {
    constructor(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers, formatContinuationError = commonFormatContinuationError) {
        this.dispatchers = dispatchers;
        this.formatContinuationError = formatContinuationError;
    }
    async dispatch(continuationData, tools, chatData, getContinuationCommand) {
        let suspended = false;
        let failed = null;
        let currentData = continuationData.data;
        const dispatchedTools = [];
        function pushResult(id, call, response) {
            dispatchedTools.push([id, Object.assign(Object.assign({}, call), { call: Object.assign(Object.assign({}, call.call), { response: response }) })]);
            if (null != response && (0, ToolsDispatcher_1.isReducerSuccess)(response)) {
                currentData = response.data;
            }
        }
        for (const [callId, callData] of tools) {
            if (suspended || null !== callData.call.response) {
                pushResult(callId, callData, callData.call.response);
                if ((0, ToolsDispatcher_1.isDispatchError)(callData.call.response)) {
                    failed = [callData.call.request, callData.call.response];
                }
                continue;
            }
            if (null != failed) {
                pushResult(callId, callData, this.formatContinuationError(...failed));
                continue;
            }
            logging_1.logger.d("Running tool:", callData.call.request.toolName);
            logging_1.logger.d("Data so far:", currentData);
            logging_1.logger.d("Arguments:", JSON.stringify(callData.call.request.args));
            const continuationCommand = getContinuationCommand({ toolId: callId.id });
            const result = await (0, ToolsDispatcher_1.dispatchToContinuation)(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(currentData, callData.call.request.toolName, callData.call.request.args, continuationCommand, chatData);
            });
            let response = null;
            if (result.isResolved()) {
                logging_1.logger.d("Resolved.");
                response = result.value;
                if ((0, ToolsDispatcher_1.isDispatchError)(response)) {
                    logging_1.logger.w("Dispatch error. Failing calls:", response.error);
                    failed = [callData.call.request, response];
                }
            }
            else {
                logging_1.logger.d("Suspended...");
                suspended = true;
            }
            pushResult(callId, callData, response);
        }
        return { suspended: suspended, data: currentData, tools: dispatchedTools };
    }
    getDispatcher(dispatcherId) {
        const dispatcher = this.dispatchers[dispatcherId];
        if (undefined === dispatcher) {
            logging_1.logger.w("Dispatcher not found:", dispatcherId);
            throw new ChatError_1.ChatError("unimplemented", true, "Dispatcher not found:", dispatcherId);
        }
        return dispatcher;
    }
}
exports.SequentialToolsContinuationDispatchRunner = SequentialToolsContinuationDispatchRunner;
function commonFormatContinuationError(toolCall) {
    return { error: `Error had occurred while calling function: ${toolCall.toolName} before. Thus this function was not processed` };
}
exports.commonFormatContinuationError = commonFormatContinuationError;
//# sourceMappingURL=ToolsContinuationDispatchRunner.js.map