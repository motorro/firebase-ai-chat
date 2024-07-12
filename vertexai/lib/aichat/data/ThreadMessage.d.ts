import { firestore } from "firebase-admin";
import Timestamp = firestore.Timestamp;
import { ChatMessage, StructuredMessage } from "@motorro/firebase-ai-chat-core";
import { GenerateContentCandidate } from "@google-cloud/vertexai";
/**
 * Vertex AI thread message
 */
export interface ThreadMessage {
    readonly candidate: GenerateContentCandidate;
    readonly createdAt: Timestamp;
    readonly inBatchSortIndex: number;
}
export type ChatThreadMessage = {
    id: string;
} & StructuredMessage & Pick<ChatMessage, "author" | "createdAt">;
