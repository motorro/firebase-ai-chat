import {Content} from "@google-cloud/vertexai";
import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {ChatMessage} from "@motorro/firebase-ai-chat-core";

/**
 * Vertex AI thread message
 */
export interface ThreadMessage {
    readonly content: Content
    readonly createdAt: Timestamp
    readonly inBatchSortIndex: number
}

export type ChatThreadMessage = {id: string} & Pick<ChatMessage, "author" | "text" | "createdAt">
