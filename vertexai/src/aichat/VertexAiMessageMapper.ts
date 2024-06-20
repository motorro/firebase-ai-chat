import {isStructuredMessage, NewMessage} from "@motorro/firebase-ai-chat-core";
import {Part} from "@google-cloud/vertexai";
import {Content} from "@google-cloud/vertexai/src/types/content";

/**
 * Maps messages to/from AI
 */
export interface VertexAiMessageMapper {
    /**
     * Maps chat data message parts to VertexAI
     * @param message Message to map to VertexAI
     * @returns VertexAI message structure
     */
    toAi(message: NewMessage): Array<Part>

    /**
     * Maps VertexAI message parts to chat message
     * @param message Message to map to chat format
     * @returns Chat message structure
     */
    fromAi(message: Content): NewMessage | undefined
}

export const DefaultVertexAiMessageMapper: VertexAiMessageMapper = {
    toAi(message: NewMessage): Array<Part> {
        if (isStructuredMessage(message)) {
            return [{
                text: message.text
            }];
        }
        return [{
            text: String(message)
        }];
    },

    fromAi(message: Content): NewMessage | undefined {
        const text: Array<string> = [];
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
