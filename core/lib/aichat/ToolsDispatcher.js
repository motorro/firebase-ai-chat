"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchToContinuation = exports.isDispatchError = exports.getDispatchError = exports.isDispatchSuccess = exports.getDispatchSuccess = exports.isDispatchResult = void 0;
const Continuation_1 = require("./data/Continuation");
const SUCCESS = Symbol("DispatchSuccess");
const ERROR = Symbol("DispatchError");
/**
 * Checks if `data` is `DispatchResult`
 * @param data Data to check
 * @return True if `data' is `DispatchResult`
 */
function isDispatchResult(data) {
    return isDispatchSuccess(data) || isDispatchError(data);
}
exports.isDispatchResult = isDispatchResult;
/**
 * Creates a success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Success result
 */
function getDispatchSuccess(data, comment) {
    return {
        data: data,
        comment: comment,
        [SUCCESS]: SUCCESS
    };
}
exports.getDispatchSuccess = getDispatchSuccess;
/**
 * Checks if `data` is `DispatchSuccess`
 * @param data Data to check
 * @return True if `data' is `DispatchSuccess`
 */
function isDispatchSuccess(data) {
    return "object" === typeof data && null !== data && SUCCESS in data && SUCCESS === data[SUCCESS];
}
exports.isDispatchSuccess = isDispatchSuccess;
/**
 * Evaluates the error message from tools dispatcher
 * @param e {unknown} Error to analyze
 * @returns {DispatchError} Normalized dispatch error
 */
function getDispatchError(e) {
    if (isDispatchError(e)) {
        return e;
    }
    if ("string" === typeof e) {
        return {
            error: e,
            [ERROR]: ERROR
        };
    }
    if ("object" === typeof e && null !== e) {
        if ("error" in e && "string" === typeof e.error) {
            return {
                error: e.error,
                [ERROR]: ERROR
            };
        }
        if ("message" in e && "string" === typeof e.message) {
            return {
                error: e.message,
                [ERROR]: ERROR
            };
        }
        return {
            error: e.toString(),
            [ERROR]: ERROR
        };
    }
    return {
        error: "Unknown error",
        [ERROR]: ERROR
    };
}
exports.getDispatchError = getDispatchError;
/**
 * Checks if `data` is `DispatchError`
 * @param data Data to check
 * @return True if `data' is `DispatchError`
 */
function isDispatchError(data) {
    return "object" === typeof data && null !== data && ERROR in data && ERROR === data[ERROR];
}
exports.isDispatchError = isDispatchError;
/**
 * Wraps dispatch to continuation
 * @param block
 */
async function dispatchToContinuation(block) {
    try {
        const result = await block();
        if (Continuation_1.Continuation.isContinuation(result)) {
            return result.isResolved() ? wrapToDispatchResult(result.value) : result;
        }
        return wrapToDispatchResult(result);
    }
    catch (e) {
        return wrapToDispatchResult(getDispatchError(e));
    }
    function wrapToDispatchResult(value) {
        if (isDispatchResult(value)) {
            return Continuation_1.Continuation.resolve(value);
        }
        else {
            return Continuation_1.Continuation.resolve(getDispatchSuccess(value));
        }
    }
}
exports.dispatchToContinuation = dispatchToContinuation;
//# sourceMappingURL=ToolsDispatcher.js.map