import {isVertexAiAssistantConfig, VertexAiAssistantConfig} from "./VertexAiAssistantConfig";

export interface PostExplicit {
    name: "postExplicit",
    messages: ReadonlyArray<string>
}

export function isPostExplicitAction(data: unknown): data is PostExplicit {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}

export interface HandBackCleanup {
    name: "handBackCleanup"
    config: VertexAiAssistantConfig
}

export function isHandBackCleanupAction(data: unknown): data is HandBackCleanup {
    return "object" === typeof data && null !== data
        && "name" in data && "handBackCleanup" === data.name
        && "config" in data && isVertexAiAssistantConfig(data.config);
}

/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatAction = "create" | "post" | "continuePost" | PostExplicit | "switchToUserInput" | "close" | HandBackCleanup;

/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatActions = ReadonlyArray<VertexAiChatAction>;
