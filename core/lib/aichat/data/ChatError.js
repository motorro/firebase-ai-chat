"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatError = void 0;
exports.isPermanentError = isPermanentError;
const https_1 = require("firebase-functions/v2/https");
/**
 * Chat error
 */
class ChatError extends https_1.HttpsError {
    constructor(code, isPermanent, message, details) {
        super(code, message, details);
        this.isPermanent = isPermanent;
    }
}
exports.ChatError = ChatError;
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
function isPermanentError(error) {
    return "object" === typeof error && null !== error
        && "isPermanent" in error && "boolean" === typeof error.isPermanent && error.isPermanent;
}
//# sourceMappingURL=ChatError.js.map