"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatchToContinuation = exports.isDispatchError = exports.getDispatchError = exports.isFunctionSuccess = exports.isReducerSuccess = exports.getReducerSuccess = exports.getFunctionSuccess = exports.isDispatchResult = void 0;
const Continuation_1 = require("./data/Continuation");
/**
 * Checks if `data` is `DispatchResult`
 * @param data Data to check
 * @return True if `data' is `DispatchResult`
 */
function isDispatchResult(data) {
    return isReducerSuccess(data) || isFunctionSuccess(data) || isDispatchError(data);
}
exports.isDispatchResult = isDispatchResult;
/**
 * Creates a function success result
 * @param result Function return value
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
function getFunctionSuccess(result, comment) {
    return Object.assign({ result: result }, (undefined !== comment ? { comment: comment } : {}));
}
exports.getFunctionSuccess = getFunctionSuccess;
/**
 * Creates a reducer success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
function getReducerSuccess(data, comment) {
    return Object.assign({ data: data }, (undefined !== comment ? { comment: comment } : {}));
}
exports.getReducerSuccess = getReducerSuccess;
/**
 * Checks if `data` is `ReducerSuccess`
 * @param data Data to check
 * @return True if `data' is `ReducerSuccess`
 */
function isReducerSuccess(data) {
    return "object" === typeof data && null !== data && "data" in data && "object" === typeof data.data && null !== data.data;
}
exports.isReducerSuccess = isReducerSuccess;
/**
 * Checks if `data` is `FunctionSuccess`
 * @param data Data to check
 * @return True if `data' is `FunctionSuccess`
 */
function isFunctionSuccess(data) {
    return "object" === typeof data && null !== data && "result" in data && "object" === typeof data.result && null !== data.result;
}
exports.isFunctionSuccess = isFunctionSuccess;
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
            error: e
        };
    }
    if ("object" === typeof e && null !== e) {
        if ("error" in e && "string" === typeof e.error) {
            return {
                error: e.error
            };
        }
        if ("message" in e && "string" === typeof e.message) {
            return {
                error: e.message
            };
        }
        return {
            error: e.toString()
        };
    }
    return {
        error: "Unknown error"
    };
}
exports.getDispatchError = getDispatchError;
/**
 * Checks if `data` is `DispatchError`
 * @param data Data to check
 * @return True if `data' is `DispatchError`
 */
function isDispatchError(data) {
    return "object" === typeof data && null !== data && "error" in data && "string" === typeof data.error;
}
exports.isDispatchError = isDispatchError;
/**
 * Wraps dispatch to continuation
 * @param block Dispatching code
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
            return Continuation_1.Continuation.resolve(getFunctionSuccess(value));
        }
    }
}
exports.dispatchToContinuation = dispatchToContinuation;
//# sourceMappingURL=ToolsDispatcher.js.map