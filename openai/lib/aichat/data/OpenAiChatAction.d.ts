import { OpenAiAssistantConfig } from "./OpenAiAssistantConfig";
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
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | PostExplicit | "run" | "retrieve" | "switchToUserInput" | "close" | HandBackCleanup;
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
