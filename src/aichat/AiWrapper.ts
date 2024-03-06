import {ToolsDispatcher} from "./ToolsDispatcher";
import {ChatData} from "./data/ChatState";

/**
 * AI Messages response
 */
export interface Messages {
    /**
     * A list of messages
     */
    readonly messages: ReadonlyArray<[string, string]>,
    /**
     * The ID of latest message to optimize retrievals
     */
    readonly latestMessageId?: string
}

/**
 * AI processing error
 */
export interface AiError {
    /**
     * If true - there is no point in retrying the operation
     */
    readonly isPermanent: boolean
}

/**
 * Checks for permanent error
 * @param error Error to check
 * @return true if error is permanent and retry has no point
 */
export function isPermanentError(error: unknown): boolean {
    return "object" === typeof error && null !== error
        && "isPermanent" in error && "boolean" === typeof error.isPermanent && error.isPermanent;
}

/**
 * Wraps OpenAI
 */
export interface AiWrapper {
    /**
     * Creates a thread
     * @param meta Thread meta
     * @return Created thread ID
     */
    createThread(meta: Readonly<Record<string, string>>): Promise<string>

    /**
     * Posts a message from user
     * @param threadId Thread ID to post to
     * @param message Message to post
     * @return Created message ID. Use in pagination
     */
    postMessage(threadId: string, message: string): Promise<string>

    /**
     * Runs assistant
     * @param threadId Thread ID
     * @param assistantId Assistant ID
     * @param dataSoFar Current data state
     * @param dispatcher Tools dispatcher
     * @return New data state
     */
    run<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatcher: ToolsDispatcher<DATA>
    ): Promise<DATA>

    /**
     * Gets thread messages
     * @param threadId Thread ID
     * @param from Message ID to start from
     * @return A batch of new messages
     */
    getMessages(threadId: string, from: string | undefined): Promise<Messages>

    /**
     * Deletes thread
     * @param threadId
     */
    deleteThread(threadId: string): Promise<void>
}
