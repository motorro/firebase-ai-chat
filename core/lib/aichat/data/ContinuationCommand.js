"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = void 0;
const ChatCommand_1 = require("./ChatCommand");
/**
 * Checks if data is a ContinuationRequest
 * @param data Data to check
 * @return True if data is ContinuationRequest
 */
function isContinuationRequest(data) {
    return "object" === typeof data && null != data
        && "continuationId" in data && "string" === typeof data.continuationId
        && "tool" in data && "object" === typeof data.tool && null !== data.tool
        && "toolId" in data.tool && "string" === typeof data.tool.toolId;
}
exports.isContinuationRequest = isContinuationRequest;
/**
 * Checks if data is a ContinuationCommand
 * @param data Data to check
 * @return True if data is ContinuationCommand
 */
function isContinuationCommand(data) {
    return (0, ChatCommand_1.isChatCommand)(data) && "continuation" in data && isContinuationRequest(data.continuation);
}
exports.isContinuationCommand = isContinuationCommand;
/**
 * Checks if data is a ContinuationCommand
 * @param req Queue request to check
 * @return True if data is ContinuationCommand request
 */
function isContinuationCommandRequest(req) {
    return isContinuationCommand(req.data);
}
exports.isContinuationCommandRequest = isContinuationCommandRequest;
//# sourceMappingURL=ContinuationCommand.js.map