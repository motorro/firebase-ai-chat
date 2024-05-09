import {AssistantConfig} from "@motorro/firebase-ai-chat-core";

/**
 * OpenAI chat configuration
 */
export interface OpenAiAssistantConfig extends AssistantConfig {
    readonly engine: "openai"
    readonly assistantId: string,
    readonly dispatcherId: string,
    readonly threadId?: string
    readonly lastMessageId?: string
}

export function isOpenAiAssistantConfig(config: unknown): config is OpenAiAssistantConfig {
    return "object" === typeof config && null !== config
        && "engine" in config && "openai" === config.engine
        && "assistantId" in config && "dispatcherId" in config;
}
