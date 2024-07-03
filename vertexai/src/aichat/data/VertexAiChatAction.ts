import {isVertexAiAssistantConfig, VertexAiAssistantConfig} from "./VertexAiAssistantConfig";
import {HandBackAction, HandOverAction, NewMessage} from "@motorro/firebase-ai-chat-core";

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
    config: VertexAiAssistantConfig
}

export function isCleanupAction(data: unknown): data is Cleanup {
    return "object" === typeof data && null !== data
        && "name" in data && "cleanup" === data.name
        && "config" in data && isVertexAiAssistantConfig(data.config);
}

/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatAction = "create" | "post" | "continuePost" | PostExplicit | "switchToUserInput" | "close" | Cleanup | HandOverAction | HandBackAction;

/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatActions = ReadonlyArray<VertexAiChatAction>;
