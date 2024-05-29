import { OpenAiAssistantConfig } from "./OpenAiAssistantConfig";
import { OpenAiChatCommand } from "./OpenAiChatCommand";
export interface PostExplicit {
    name: "postExplicit";
    messages: ReadonlyArray<string>;
}
export declare function isPostExplicitAction(data: unknown): data is PostExplicit;
export interface HandBackCleanup {
    name: "handBackCleanup";
    config: OpenAiAssistantConfig;
}
export declare function isHandBackCleanupAction(data: unknown): data is HandBackCleanup;
export interface ToolContinuation {
    name: "toolContinuation";
    readonly runId: string;
    readonly next: OpenAiChatCommand;
}
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | PostExplicit | "run" | "continueRun" | "retrieve" | "switchToUserInput" | "close" | HandBackCleanup;
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
