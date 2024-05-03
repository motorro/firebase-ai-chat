import {ChatData, SystemInstructions, ToolsDispatcher} from "@motorro/firebase-ai-chat-core";
import {Tool} from "@google-cloud/vertexai/src/types/content";

/**
 * System instructions for VertexAI
 */
export interface VertexAiSystemInstructions<DATA extends ChatData> extends SystemInstructions {
    /**
     * Tools definition
     */
    readonly tools?: VertexAiTools<DATA>
}

/**
 * VertexAI tools definition
 */
export interface VertexAiTools<DATA extends ChatData> {
    /**
     * Bound dispatcher
     */
    readonly dispatcher: ToolsDispatcher<DATA>

    /**
     * Tools definition
     */
    readonly definition: Array<Tool>
}
