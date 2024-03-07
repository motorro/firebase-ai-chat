import {ChatConfig} from "./ChatConfig";
import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;

/**
 * Chat status
 */
export type ChatStatus = "userInput" | "processing" | "closing" | "complete" | "failed";

export type ChatData = Record<string, unknown>;

export interface ChatState<out DATA extends ChatData> {
    readonly userId: string,
    readonly config: ChatConfig
    readonly status: ChatStatus
    readonly latestDispatchId: string
    readonly data: DATA,
    readonly lastMessageId?: string
    readonly createdAt: Timestamp,
    readonly updatedAt: Timestamp
}

export interface ChatStateUpdate<DATA> {
    status: ChatStatus,
    data: DATA
    readonly lastMessageId?: string
}
