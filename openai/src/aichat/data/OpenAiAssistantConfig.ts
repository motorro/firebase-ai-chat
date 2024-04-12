import {AssistantConfig} from "@motorro/firebase-ai-chat-core";

/**
 * OpenAI chat configuration
 */
export interface OpenAiAssistantConfig extends AssistantConfig {
    readonly engine: "openai"
    readonly assistantId: string
}
