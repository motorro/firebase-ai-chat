/**
 * AI Messages response
 */
export interface Messages {
    /**
     * A list of messages
     */
    readonly messages: ReadonlyArray<[string, string]>;
    /**
     * The ID of latest message to optimize retrievals
     */
    readonly latestMessageId?: string;
}
/**
 * AI processing error
 */
export interface AiError {
    /**
     * If true - there is no point in retrying the operation
     */
    readonly isPermanent: boolean;
}
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
export declare function isPermanentError(error: unknown): boolean;
export interface SystemInstructions {
    /**
     * AI instructions
     */
    readonly instructions: string;
    /**
     * AI examples if any
     */
    readonly examples?: ReadonlyArray<AiResponseExample | AiFunctionCallExample> | null;
}
/**
 * Example for AI
 */
export interface AiExample {
    /**
     * Example type
     */
    type: "response" | "functionCall";
}
/**
 * Response example
 */
export interface AiResponseExample extends AiExample {
    /**
     * Example type
     */
    type: "response";
    /**
     * Question from user
     */
    input: string;
    /**
     * Response from AI
     */
    output: string;
}
export interface AiFunctionCallExample extends AiExample {
    /**
     * Example type
     */
    type: "functionCall";
    /**
     * Question from user
     */
    input: string;
    /**
     * Function name
     */
    name: string;
    /**
     * Function arguments
     */
    arguments: Record<string, unknown>;
}
/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
export declare function printAiExample(example: AiExample, exampleNumber?: number): string;
