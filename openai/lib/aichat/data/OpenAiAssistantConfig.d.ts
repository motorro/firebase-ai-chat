import { AssistantConfig } from "@motorro/firebase-ai-chat-core";
import { engineId } from "../../engineId";
/**
 * OpenAI chat configuration
 */
export interface OpenAiAssistantConfig extends AssistantConfig {
    readonly engine: typeof engineId;
    readonly assistantId: string;
    readonly dispatcherId: string;
    readonly threadId?: string;
    readonly lastMessageId?: string;
}
export declare function isOpenAiAssistantConfig(config: unknown): config is OpenAiAssistantConfig;
