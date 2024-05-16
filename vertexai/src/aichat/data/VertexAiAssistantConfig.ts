import {AssistantConfig} from "@motorro/firebase-ai-chat-core";
import {engineId} from "../../engineId";

/**
 * OpenAI chat configuration
 */
export interface VertexAiAssistantConfig extends AssistantConfig {
    /**
     * Engine name
     */
    readonly engine: typeof engineId

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
        && "engine" in config && engineId === config.engine
        && "instructionsId" in config;
}
