import { NewMessage } from "@motorro/firebase-ai-chat-core";
import { Part } from "@google-cloud/vertexai";
import { Content } from "@google-cloud/vertexai/src/types/content";
/**
 * Maps messages to/from AI
 */
export interface VertexAiMessageMapper {
    /**
     * Maps chat data message parts to VertexAI
     * @param message Message to map to VertexAI
     * @returns VertexAI message structure
     */
    toAi(message: NewMessage): Array<Part>;
    /**
     * Maps VertexAI message parts to chat message
     * @param message Message to map to chat format
     * @returns Chat message structure
     */
    fromAi(message: Content): NewMessage | undefined;
}
export declare const DefaultVertexAiMessageMapper: VertexAiMessageMapper;
