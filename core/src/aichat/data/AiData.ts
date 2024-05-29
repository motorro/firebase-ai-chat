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
    readonly examples?: ReadonlyArray<AiResponseExample | AiFunctionCallExample> | null
}

/**
 * Example for AI
 */
export interface AiExample {
    /**
     * Example type
     */
    type: "response" | "functionCall"
}

/**
 * Response example
 */
export interface AiResponseExample extends AiExample {
    /**
     * Example type
     */
    type: "response"

    /**
     * Question from user
     */
    input: string

    /**
     * Response from AI
     */
    output: string
}

export interface AiFunctionCallExample extends AiExample {
    /**
     * Example type
     */
    type: "functionCall"

    /**
     * Question from user
     */
    input: string

    /**
     * Function name
     */
    name: string

    /**
     * Function arguments
     */
    arguments: Record<string, unknown>
}

/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
export function printAiExample(example: AiExample, exampleNumber?: number): string {
    switch (example.type) {
        case "functionCall":
            return printFunctionCall(<AiFunctionCallExample>example);
        default:
            return printResponse(<AiResponseExample>example);
    }

    function printResponse(example: AiResponseExample): string {
        return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput from user: ${example.input}\nOutput: ${example.output}`;
    }

    function printFunctionCall(example: AiFunctionCallExample): string {
        // eslint-disable-next-line max-len
        return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput from user: ${example.input}\nFunction to call: ${example.name}\nFunction arguments: ${JSON.stringify(example.arguments)}`;
    }
}

