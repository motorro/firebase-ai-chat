import {isOpenAiAssistantConfig, OpenAiAssistantConfig} from "./OpenAiAssistantConfig";
import {OpenAiChatCommand} from "./OpenAiChatCommand";

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
    config: OpenAiAssistantConfig
}

export function isHandBackCleanupAction(data: unknown): data is HandBackCleanup {
    return "object" === typeof data && null !== data
        && "name" in data && "handBackCleanup" === data.name
        && "config" in data && isOpenAiAssistantConfig(data.config);
}

export interface ToolContinuation {
    name: "toolContinuation",
    readonly runId: string
    readonly next: OpenAiChatCommand
}


/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | PostExplicit | "run" | "continueRun" | "retrieve" | "switchToUserInput" | "close" | HandBackCleanup;

/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
