export interface SystemInstructions {
    /**
     * AI instructions
     */
    readonly instructions: string;
    /**
     * AI examples if any
     */
    readonly examples?: ReadonlyArray<AiExample> | null;
}
/**
 * Example for AI
 */
export interface AiExample {
    input: string;
    output: string;
}
/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
export declare function printAiExample(example: AiExample, exampleNumber?: number): string;
