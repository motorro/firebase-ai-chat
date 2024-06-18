"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultVertexAiMessageMapper = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
exports.DefaultVertexAiMessageMapper = {
    toAi(message) {
        if ((0, firebase_ai_chat_core_1.isStructuredMessage)(message)) {
            return [{
                    text: message.text
                }];
        }
        return [{
                text: String(message)
            }];
    },
    fromAi(message) {
        const text = [];
        for (const part of message.parts) {
            if (undefined !== part.text) {
                text.push(part.text);
            }
        }
        if (0 !== text.length) {
            return text.join("\n");
        }
        return undefined;
    }
};
//# sourceMappingURL=VertexAiMessageMapper.js.map