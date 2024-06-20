import { OpenAiAssistantConfig } from "./OpenAiAssistantConfig";
import { NewMessage } from "@motorro/firebase-ai-chat-core";
export interface PostExplicit {
    name: "postExplicit";
    messages: ReadonlyArray<NewMessage>;
}
export declare function isPostExplicitAction(data: unknown): data is PostExplicit;
export interface Cleanup {
    name: "cleanup";
    config: OpenAiAssistantConfig;
}
export declare function isCleanupAction(data: unknown): data is Cleanup;
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | PostExplicit | "run" | "continueRun" | "retrieve" | "switchToUserInput" | "close" | Cleanup;
/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
