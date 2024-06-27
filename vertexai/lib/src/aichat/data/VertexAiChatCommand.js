"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVertexAiContinuationCommand = exports.isVertexAiChatReq = exports.isVertexAiChatCommand = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const engineId_1 = require("../../engineId");
function isVertexAiChatCommand(data) {
    return "object" === typeof data && null !== data && "engine" in data && engineId_1.engineId === data.engine;
}
exports.isVertexAiChatCommand = isVertexAiChatCommand;
function isVertexAiChatReq(req) {
    return isVertexAiChatCommand(req.data);
}
exports.isVertexAiChatReq = isVertexAiChatReq;
function isVertexAiContinuationCommand(command) {
    return (0, firebase_ai_chat_core_1.isContinuationCommand)(command) && isVertexAiChatCommand(command) && "continuePost" === command.actionData[0];
}
exports.isVertexAiContinuationCommand = isVertexAiContinuationCommand;
//# sourceMappingURL=VertexAiChatCommand.js.map