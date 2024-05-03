"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDispatchError = void 0;
/**
 * Evaluates the error message from tools dispatcher
 * @param e {unknown} Error to analyze
 * @returns {DispatchError} Normalized dispatch error
 */
function getDispatchError(e) {
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
//# sourceMappingURL=ToolsDispatcher.js.map