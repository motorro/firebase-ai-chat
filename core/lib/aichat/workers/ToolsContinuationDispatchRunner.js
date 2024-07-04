"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonFormatContinuationError = exports.SequentialToolsContinuationDispatchRunner = void 0;
const ToolsDispatcher_1 = require("../ToolsDispatcher");
const logging_1 = require("../../logging");
const ChatError_1 = require("../data/ChatError");
const logger = (0, logging_1.tagLogger)("ToolsContinuationDispatchRunner");
/**
 * Runs passed tools sequentially suspending continuation if suspended.
 * If any call fails - also fails other subsequent calls
 */
// eslint-disable-next-line max-len
class SequentialToolsContinuationDispatchRunner {
    constructor(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers, formatContinuationError = commonFormatContinuationError, logData = false) {
        this.dispatchers = dispatchers;
        this.formatContinuationError = formatContinuationError;
        this.logData = logData;
    }
    async dispatch(soFar, continuationData, tools, chatData, dispatchControl) {
        let suspended = false;
        let failed = null;
        let currentData = soFar;
        const dispatchedTools = [];
        let handOverAction = continuationData.handOver;
        function pushResult(id, call, response) {
            dispatchedTools.push([id, Object.assign(Object.assign({}, call), { call: Object.assign(Object.assign({}, call.call), { response: response }) })]);
            if (null != response && (0, ToolsDispatcher_1.isReducerSuccess)(response)) {
                currentData = response.data;
            }
        }
        const handOver = {
            handOver(data) {
                handOverAction = {
                    name: "handOver",
                    config: data.config,
                    messages: data.messages,
                    chatMeta: data.chatMeta
                };
            },
            handBack(messages) {
                handOverAction = {
                    name: "handBack",
                    messages: messages
                };
            }
        };
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
            logger.d("Running tool:", callData.call.request.toolName);
            if (this.logData) {
                (0, logging_1.tagLogger)("DATA").d("Data so far:", currentData);
                (0, logging_1.tagLogger)("DATA").d("Arguments:", JSON.stringify(callData.call.request.args));
            }
            const continuationCommand = dispatchControl.getContinuationCommand({ toolId: callId.id });
            const result = await (0, ToolsDispatcher_1.dispatchToContinuation)(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(currentData, callData.call.request.toolName, callData.call.request.args, continuationCommand, chatData, handOver);
            });
            let response = null;
            if (result.isResolved()) {
                logger.d("Resolved.");
                response = result.value;
                if (this.logData) {
                    if ((0, ToolsDispatcher_1.isReducerSuccess)(response)) {
                        (0, logging_1.tagLogger)("DATA").d("Data after:", JSON.stringify(response.data));
                    }
                    if ((0, ToolsDispatcher_1.isFunctionSuccess)(response)) {
                        (0, logging_1.tagLogger)("DATA").d("Result after:", JSON.stringify(response.result));
                    }
                }
                if ((0, ToolsDispatcher_1.isDispatchError)(response)) {
                    logger.w("Dispatch error. Failing calls:", response.error);
                    failed = [callData.call.request, response];
                }
            }
            else {
                logger.d("Suspended...");
                suspended = true;
            }
            pushResult(callId, callData, response);
        }
        return { suspended: suspended, data: currentData, tools: dispatchedTools, handOver: handOverAction };
    }
    getDispatcher(dispatcherId) {
        const dispatcher = this.dispatchers[dispatcherId];
        if (undefined === dispatcher) {
            logger.w("Dispatcher not found:", dispatcherId);
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