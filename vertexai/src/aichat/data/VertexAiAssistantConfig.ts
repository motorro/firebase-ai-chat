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

    /**
     * Thread ID
     */
    readonly threadId?: string
}

export function isVertexAiAssistantConfig(config: unknown): config is VertexAiAssistantConfig {
    return "object" === typeof config && null !== config
        && "engine" in config && "vertexai" === config.engine
        && "instructionsId" in config;
}
