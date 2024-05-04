import {ChatData} from "@motorro/firebase-ai-chat-core";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";
import {ChatThreadMessage} from "./data/ThreadMessage";

/**
 * Post message result
 */
export interface PostMessageResult<DATA extends ChatData> {
    readonly data: DATA
    readonly messages: ReadonlyArray<ChatThreadMessage>
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
    createThread(meta: Readonly<Record<string, string>>): Promise<string>

    /**
     * Runs assistant
     * @param threadId Thread ID
     * @param instructions VertexAI system instructions
     * @param messages Message to append
     * @param dataSoFar Current data state
     * @return New data state and new chat thread messages
     */
    postMessage<DATA extends ChatData>(
        threadId: string,
        instructions: VertexAiSystemInstructions<DATA>,
        messages: ReadonlyArray<string>,
        dataSoFar: DATA
    ): Promise<PostMessageResult<DATA>>

    /**
     * Deletes thread
     * @param threadId
     */
    deleteThread(threadId: string): Promise<void>
}
