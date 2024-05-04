"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printAiExample = void 0;
/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
function printAiExample(example, exampleNumber) {
    return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput: ${example.input}\nOutput: ${example.output}`;
}
exports.printAiExample = printAiExample;
//# sourceMappingURL=SystemInstructions.js.map