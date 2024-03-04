import { HttpsError } from "firebase-functions/v2/https";
import { FunctionsErrorCode } from "firebase-functions/lib/common/providers/https";
/**
 * Chat error
 */
export declare class ChatError extends HttpsError {
    /**
     * Indicates that the retry has no use
     */
    readonly isPermanent: boolean;
    constructor(code: FunctionsErrorCode, isPermanent: boolean, message: string, details?: unknown);
}
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
export declare function isPermanentError(error: unknown): boolean;
