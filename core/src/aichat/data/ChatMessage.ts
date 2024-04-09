import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;

export interface ChatMessage {
    readonly userId: string,
    readonly dispatchId: string
    readonly author: "user" | "ai"
    readonly text: string
    readonly inBatchSortIndex: number,
    readonly createdAt: Timestamp
}
