import {isStructuredMessage, NewMessage} from "@motorro/firebase-ai-chat-core";
import {GenerateContentCandidate, Part} from "@google-cloud/vertexai";

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
     * @param candidate Content candidate
     * @returns Chat message structure
     */
    fromAi(candidate: GenerateContentCandidate): NewMessage | undefined
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

    fromAi(candidate: GenerateContentCandidate): NewMessage | undefined {
        const text: Array<string> = [];
        for (const part of candidate.content.parts) {
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
