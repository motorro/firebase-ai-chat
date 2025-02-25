"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultOpenAiMessageMapper = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
exports.DefaultOpenAiMessageMapper = {
    toAi(message) {
        if ((0, firebase_ai_chat_core_1.isStructuredMessage)(message)) {
            const meta = message.meta;
            let openAiMeta = {};
            if (meta) {
                Object.keys(meta).forEach((key) => {
                    const value = meta[key];
                    if ("string" === typeof value) {
                        openAiMeta[key] = value;
                    }
                    else {
                        throw new firebase_ai_chat_core_1.ChatError("invalid-argument", true, "OpenAI accepts only string values as Metadata. Stringify your values explicitly!");
                    }
                });
            }
            return {
                content: message.text,
                metadata: openAiMeta
            };
        }
        return {
            content: String(message)
        };
    },
    fromAi(message) {
        const text = [];
        for (const content of message.content) {
            if ("text" === content.type) {
                text.push(content.text.value);
            }
        }
        return {
            text: text.join("\n"),
            meta: message.metadata
        };
    }
};
//# sourceMappingURL=OpenAiMessageMapper.js.map