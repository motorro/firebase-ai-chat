"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPermanentError = isPermanentError;
exports.printAiExample = printAiExample;
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
function isPermanentError(error) {
    return "object" === typeof error && null !== error
        && "isPermanent" in error && "boolean" === typeof error.isPermanent && error.isPermanent;
}
/**
 * Prints example for AI
 * @param example Example to print
 * @param exampleNumber Optional number
 * @returns TPrinted example
 */
function printAiExample(example, exampleNumber) {
    switch (example.type) {
        case "functionCall":
            return printFunctionCall(example);
        default:
            return printResponse(example);
    }
    function printResponse(example) {
        return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput from user: ${example.input}\nOutput: ${example.output}`;
    }
    function printFunctionCall(example) {
        // eslint-disable-next-line max-len
        return `EXAMPLE${exampleNumber ? ` ${exampleNumber}` : ""}\nInput from user: ${example.input}\nFunction to call: ${example.name}\nFunction arguments: ${JSON.stringify(example.arguments)}`;
    }
}
//# sourceMappingURL=AiData.js.map