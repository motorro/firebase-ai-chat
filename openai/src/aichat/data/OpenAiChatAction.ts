import {isOpenAiAssistantConfig, OpenAiAssistantConfig} from "./OpenAiAssistantConfig";
import {NewMessage} from "@motorro/firebase-ai-chat-core";

export interface PostExplicit {
    name: "postExplicit",
    messages: ReadonlyArray<NewMessage>
}

export function isPostExplicitAction(data: unknown): data is PostExplicit {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}

export interface Cleanup {
    name: "cleanup"
    config: OpenAiAssistantConfig
}

export function isCleanupAction(data: unknown): data is Cleanup {
    return "object" === typeof data && null !== data
        && "name" in data && "cleanup" === data.name
        && "config" in data && isOpenAiAssistantConfig(data.config);
}

/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | PostExplicit | "run" | "continueRun" | "retrieve" | "switchToUserInput" | "close" | Cleanup;

/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
