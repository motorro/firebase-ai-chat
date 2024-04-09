"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPermanentError = void 0;
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
function isPermanentError(error) {
    return "object" === typeof error && null !== error
        && "isPermanent" in error && "boolean" === typeof error.isPermanent && error.isPermanent;
}
exports.isPermanentError = isPermanentError;
//# sourceMappingURL=AiWrapper.js.map