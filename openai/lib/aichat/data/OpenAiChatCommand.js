"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenAiContinuationCommandRequest = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
function isOpenAiContinuationCommandRequest(req) {
    return (0, firebase_ai_chat_core_1.isContinuationCommandRequest)(req);
}
exports.isOpenAiContinuationCommandRequest = isOpenAiContinuationCommandRequest;
//# sourceMappingURL=OpenAiChatCommand.js.map