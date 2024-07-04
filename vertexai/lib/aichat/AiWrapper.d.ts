import { ChatData, Continuation, HandBackAction, HandOverAction, NewMessage, ToolCallRequest, ToolCallsResult, ToolContinuationSoFar } from "@motorro/firebase-ai-chat-core";
import { VertexAiSystemInstructions } from "./data/VertexAiSystemInstructions";
import { ChatThreadMessage } from "./data/ThreadMessage";
import { RunContinuationRequest } from "./data/RunResponse";
/**
 * Post message result
 */
export interface PostMessageResult<DATA extends ChatData> {
    readonly data: DATA;
    readonly messages: ReadonlyArray<ChatThreadMessage>;
    readonly handOver: HandOverAction | HandBackAction | null;
}
/**
 * Wraps VertexAI
 */
export interface AiWrapper {
    /**
     * Creates a thread
     * @param meta Thread meta
     * @return Created thread ID
     */
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    /**
     * Runs assistant
     * @param threadId Thread ID
     * @param instructions VertexAI system instructions
     * @param messages Message to append
     * @param soFar Current data state
     * @param dispatch Tool dispatch function
     * @return New data state and new chat thread messages
     */
    postMessage<DATA extends ChatData>(threadId: string, instructions: VertexAiSystemInstructions<DATA>, messages: ReadonlyArray<NewMessage>, soFar: DATA, dispatch: (data: ToolContinuationSoFar<DATA>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>): Promise<Continuation<PostMessageResult<DATA>>>;
    /**
     * Processes AI tools response
     * @param threadId Thread ID
     * @param instructions VertexAI system instructions
     * @param request Tools dispatch request
     * @param soFar Data so far
     * @param dispatch Tool dispatch function
     * @return New data state
     */
    processToolsResponse<DATA extends ChatData>(threadId: string, instructions: VertexAiSystemInstructions<DATA>, request: RunContinuationRequest<DATA>, soFar: DATA, dispatch: (data: ToolContinuationSoFar<DATA>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>): Promise<Continuation<PostMessageResult<DATA>>>;
    /**
     * Deletes thread
     * @param threadId
     */
    deleteThread(threadId: string): Promise<void>;
}
