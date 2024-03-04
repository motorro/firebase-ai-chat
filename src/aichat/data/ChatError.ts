import {HttpsError} from "firebase-functions/v2/https";
import {FunctionsErrorCode} from "firebase-functions/lib/common/providers/https";

/**
 * Chat error
 */
export class ChatError extends HttpsError {
    /**
     * Indicates that the retry has no use
     */
    readonly isPermanent: boolean;

    constructor(code: FunctionsErrorCode, isPermanent: boolean, message: string, details?: unknown) {
        super(code, message, details);
        this.isPermanent = isPermanent;
    }
}

/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
export function isPermanentError(error: unknown): boolean {
    return "object" === typeof error && null !== error
        && "isPermanent" in error && "boolean" === typeof error.isPermanent && error.isPermanent;
}
