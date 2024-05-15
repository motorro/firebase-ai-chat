import { ChatData, Continuation, Messages, ToolsContinuationDispatcher } from "@motorro/firebase-ai-chat-core";
import { RunContinuationMeta, RunContinuationRequest } from "./data/RunResponse";
/**
 * Wraps OpenAI Assistant
 */
export interface AiWrapper {
    /**
     * Creates a thread
     * @param meta Thread meta
     * @return Created thread ID
     */
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    /**
     * Posts a message from user
     * @param threadId Thread ID to post to
     * @param message Message to post
     * @return Created message ID. Use in pagination
     */
    postMessage(threadId: string, message: string): Promise<string>;
    /**
     * Runs assistant
     * @param threadId Thread ID
     * @param assistantId Assistant ID
     * @param dataSoFar Current data state
     * @param dispatcher Continuation dispatcher
     * @return New data state
     */
    run<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>): Promise<Continuation<DATA>>;
    /**
     * Processes AI tools response
     * @param threadId Thread ID
     * @param assistantId Assistant ID
     * @param dataSoFar Current data state
     * @param dispatcher Continuation dispatcher
     * @param request Tools dispatch request
     * @return New data state
     */
    processToolsResponse<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>, request: RunContinuationRequest<DATA>): Promise<Continuation<DATA>>;
    /**
     * Gets thread messages
     * @param threadId Thread ID
     * @param from Message ID to start from
     * @return A batch of new messages
     */
    getMessages(threadId: string, from: string | undefined): Promise<Messages>;
    /**
     * Deletes thread
     * @param threadId
     */
    deleteThread(threadId: string): Promise<void>;
}
