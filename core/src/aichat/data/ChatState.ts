import {ChatConfig} from "./ChatConfig";
import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;

/**
 * Chat status
 */
export type ChatStatus = "userInput" | "processing" | "closing" | "complete" | "failed";

/**
 * Assistant configuration
 */
export type AssistantConfig = Record<string, unknown>;
/**
 * Chat data
 */
export type ChatData = Record<string, unknown>;

export interface ChatState<out C extends AssistantConfig, out DATA extends ChatData> {
    readonly userId: string,
    readonly config: ChatConfig<C>
    readonly status: ChatStatus
    readonly latestDispatchId: string
    readonly data: DATA,
    readonly lastMessageId?: string
    readonly createdAt: Timestamp,
    readonly updatedAt: Timestamp,
    readonly lastError?: string
}

export interface ChatStateUpdate<DATA> {
    status: ChatStatus,
    data: DATA
    readonly lastMessageId?: string
}
