import {AssistantConfig} from "@motorro/firebase-ai-chat-core";

/**
 * OpenAI chat configuration
 */
export interface VertexAiAssistantConfig extends AssistantConfig {
    /**
     * Engine name
     */
    readonly engine: "vertexai"

    /**
     * ID of `VertexAiSystemInstructions` to take from dispatcher registry
     */
    readonly instructionsId: string
}