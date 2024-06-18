import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;
import { Meta } from "./Meta";
export interface ChatMessage {
    readonly userId: string;
    readonly dispatchId: string;
    readonly author: "user" | "ai";
    readonly text: string;
    readonly data: Readonly<Record<string, unknown>> | null;
    readonly inBatchSortIndex: number;
    readonly createdAt: Timestamp;
    readonly meta: Meta | null;
}
