import {ChatConfig} from "./ChatConfig";
import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;
import {ChatMeta} from "./Meta";

/**
 * Chat status
 */
export type ChatStatus = "userInput" | "processing" | "complete" | "failed";

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
export interface ChatState<out C extends AssistantConfig, out DATA extends ChatData, M extends ChatMeta = ChatMeta> {
    /**
     * Owning user
     */
    readonly userId: string

    /**
     * Chat config
     */
    readonly config: ChatConfig<C>

    /**
     * Chat status
     */
    readonly status: ChatStatus

    /**
     * Some session ID that is being added to each message
     * Saved/restored when chat is handed over
     */
    readonly sessionId?: string

    /**
     * Latest command dispatch ID
     */
    readonly latestDispatchId: string

    /**
     * Chat data
     */
    readonly data: DATA,

    /**
     * Time created
     */
    readonly createdAt: Timestamp,

    /**
     * Time updated
     */
    readonly updatedAt: Timestamp,

    /**
     * Latest error if chat status is failed
     */
    readonly lastError?: string

    /**
     * Chat metadata
     */
    readonly meta: M | null
}

/**
 * Chat state update
 */
export interface ChatStateUpdate<DATA> {
    status: ChatStatus,
    data: DATA
}

/**
 * Chat context stack entry
 */
// eslint-disable-next-line max-len
export interface ChatContextStackEntry<out DATA extends ChatData, out CM extends ChatMeta = ChatMeta> extends Pick<ChatState<AssistantConfig, DATA, CM>, "config" | "meta" | "sessionId"> {
    readonly createdAt: Timestamp
}
