import { ChatConfig } from "./ChatConfig";
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
/**
 * Chat state
 */
export interface ChatState<out C extends AssistantConfig, out DATA extends ChatData> {
    /**
     * Owning user
     */
    readonly userId: string;
    /**
     * Chat config
     */
    readonly config: ChatConfig<C>;
    /**
     * Chat status
     */
    readonly status: ChatStatus;
    /**
     * Latest command dispatch ID
     */
    readonly latestDispatchId: string;
    /**
     * Chat data
     */
    readonly data: DATA;
    /**
     * Time created
     */
    readonly createdAt: Timestamp;
    /**
     * Time updated
     */
    readonly updatedAt: Timestamp;
    /**
     * Latest error if chat status is failed
     */
    readonly lastError?: string;
}
/**
 * Chat state update
 */
export interface ChatStateUpdate<DATA> {
    status: ChatStatus;
    data: DATA;
}
/**
 * Chat context stack entry
 */
export interface ChatContextStackEntry<out DATA extends ChatData> extends Pick<ChatState<AssistantConfig, DATA>, "config" | "status" | "latestDispatchId"> {
    readonly createdAt: Timestamp;
}
