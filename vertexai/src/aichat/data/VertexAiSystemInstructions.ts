import {ChatData, ChatMeta, Meta, SystemInstructions, ToolsDispatcher} from "@motorro/firebase-ai-chat-core";
import {Tool} from "@google-cloud/vertexai/src/types/content";

/**
 * System instructions for VertexAI
 */
export interface VertexAiSystemInstructions<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> extends SystemInstructions {
    /**
     * Tools definition
     */
    readonly tools?: VertexAiTools<DATA, WM, CM>
}

/**
 * VertexAI tools definition
 */
export interface VertexAiTools<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    /**
     * Bound dispatcher
     */
    readonly dispatcher: ToolsDispatcher<DATA, WM, CM>

    /**
     * Tools definition
     */
    readonly definition: Array<Tool>
}
