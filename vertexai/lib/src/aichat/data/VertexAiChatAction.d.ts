import { VertexAiAssistantConfig } from "./VertexAiAssistantConfig";
import { NewMessage } from "@motorro/firebase-ai-chat-core";
export interface PostExplicit {
    name: "postExplicit";
    messages: ReadonlyArray<NewMessage>;
}
export declare function isPostExplicitAction(data: unknown): data is PostExplicit;
export interface Cleanup {
    name: "cleanup";
    config: VertexAiAssistantConfig;
}
export declare function isCleanupAction(data: unknown): data is Cleanup;
/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatAction = "create" | "post" | "continuePost" | PostExplicit | "switchToUserInput" | "close" | Cleanup;
/**
 * VertexAI Assistant chat actions
 */
export type VertexAiChatActions = ReadonlyArray<VertexAiChatAction>;
