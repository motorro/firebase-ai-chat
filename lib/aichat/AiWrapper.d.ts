import { ToolsDispatcher } from "./ToolsDispatcher";
import { ChatData } from "./data/ChatState";
/**
 * AI Messages response
 */
export interface Messages {
    /**
     * A list of messages
     */
    readonly messages: ReadonlyArray<string>;
    /**
     * The ID of latest message to optimize retrievals
     */
    readonly latestMessageId?: string;
}
/**
 * AI processing error
 */
export interface AiError {
    /**
     * If true - there is no point in retrying the operation
     */
    readonly isPermanent: boolean;
}
/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
export declare function isPermanentError(error: unknown): boolean;
export interface AiWrapper {
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    postMessages(threadId: string, messages: ReadonlyArray<string>): Promise<string | undefined>;
    run<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsDispatcher<DATA>): Promise<DATA>;
    getMessages(threadId: string, from: string | undefined): Promise<Messages>;
    deleteThread(threadId: string): Promise<void>;
}
