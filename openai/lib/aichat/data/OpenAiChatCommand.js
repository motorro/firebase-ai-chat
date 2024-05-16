"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenAiContinuationCommand = exports.isOpenAiContinuationMeta = exports.isOpenAiChatCommand = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const engineId_1 = require("../../engineId");
function isOpenAiChatCommand(data) {
    return (0, firebase_ai_chat_core_1.isChatCommand)(data) && "engine" in data && engineId_1.engineId === data.engine;
}
exports.isOpenAiChatCommand = isOpenAiChatCommand;
function isOpenAiContinuationMeta(data) {
    return "object" === typeof data && null !== data && "runId" in data && "string" === typeof data.runId;
}
exports.isOpenAiContinuationMeta = isOpenAiContinuationMeta;
function isOpenAiContinuationCommand(command) {
    return (0, firebase_ai_chat_core_1.isContinuationCommand)(command) && isOpenAiChatCommand(command)
        && "continueRun" === command.actionData[0]
        && "meta" in command && isOpenAiContinuationMeta(command.meta);
}
exports.isOpenAiContinuationCommand = isOpenAiContinuationCommand;
//# sourceMappingURL=OpenAiChatCommand.js.map