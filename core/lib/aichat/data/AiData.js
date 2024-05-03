"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printAiExample = exports.isPermanentError = void 0;
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
//# sourceMappingURL=AiData.js.map