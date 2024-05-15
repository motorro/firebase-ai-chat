"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = void 0;
/**
 * Checks if data is a ContinuationRequest
 * @param data Data to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is ContinuationRequest
 */
function isContinuationRequest(data, isMeta) {
    return "object" === typeof data && null != data
        && "continuationId" in data && "string" === typeof data.continuationId
        && "responseId" in data && "string" === typeof data.responseId
        && "response" in data
        && "continuationMeta" in data && "object" == data.continuationMeta && isMeta(data.continuationMeta);
}
exports.isContinuationRequest = isContinuationRequest;
/**
 * Checks if data is a ContinuationCommand
 * @param data Data to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is ContinuationCommand
 */
function isContinuationCommand(data, isMeta) {
    return "object" === typeof data && null !== data
        && "commonData" in data
        && "actionData" in data && isContinuationRequest(data.actionData, isMeta);
}
exports.isContinuationCommand = isContinuationCommand;
/**
 * Checks if data is a ContinuationCommand
 * @param req Queue request to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is BoundContinuationCommand request
 */
function isContinuationCommandRequest(req, isMeta) {
    return "object" === typeof req.data && null !== req.data
        && "queueName" in req.data && "string" === typeof req.data.queueName
        && "command" in req.data && isContinuationCommand(req.data.command, isMeta);
}
exports.isContinuationCommandRequest = isContinuationCommandRequest;
//# sourceMappingURL=ContinuationCommand.js.map