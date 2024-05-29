import { VertexAiAssistantConfig } from "./VertexAiAssistantConfig";
export interface PostExplicit {
    name: "postExplicit";
    messages: ReadonlyArray<string>;
}
export declare function isPostExplicitAction(data: unknown): data is PostExplicit;
export interface HandBackCleanup {
    name: "handBackCleanup";
    config: VertexAiAssistantConfig;
}
export declare function isHandBackCleanupAction(data: unknown): data is HandBackCleanup;
/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatAction = "create" | "post" | "continuePost" | PostExplicit | "switchToUserInput" | "close" | HandBackCleanup;
/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatActions = ReadonlyArray<VertexAiChatAction>;
