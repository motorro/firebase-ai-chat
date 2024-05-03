/**
 * AI Messages response
 */
export interface Messages {
    /**
     * A list of messages
     */
    readonly messages: ReadonlyArray<[string, string]>,
    /**
     * The ID of latest message to optimize retrievals
     */
    readonly latestMessageId?: string
}

/**
 * AI processing error
 */
export interface AiError {
    /**
     * If true - there is no point in retrying the operation
     */
    readonly isPermanent: boolean
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

export interface SystemInstructions {
    /**
     * AI instructions
     */
    readonly instructions: string

    /**
     * AI examples if any
     */
    readonly examples?: ReadonlyArray<AiExample> | null
}

/**
 * Example for AI
 */
export interface AiExample {
    input: string,
    output: string
}

/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
export function printAiExample(example: AiExample, exampleNumber?: number): string {
    return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput: ${example.input}\nOutput: ${example.output}`;
}

