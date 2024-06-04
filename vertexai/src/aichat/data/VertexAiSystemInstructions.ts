import {ChatData, ChatMeta, SystemInstructions, ToolsDispatcher} from "@motorro/firebase-ai-chat-core";
import {Tool} from "@google-cloud/vertexai/src/types/content";

/**
 * System instructions for VertexAI
 */
export interface VertexAiSystemInstructions<DATA extends ChatData, CM extends ChatMeta = ChatMeta> extends SystemInstructions {
    /**
     * Tools definition
     */
    readonly tools?: VertexAiTools<DATA, CM>
}

/**
 * VertexAI tools definition
 */
export interface VertexAiTools<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Bound dispatcher
     */
    readonly dispatcher: ToolsDispatcher<DATA, CM>

    /**
     * Tools definition
     */
    readonly definition: Array<Tool>
}
