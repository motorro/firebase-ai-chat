/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatAction = "create" | "post" | "run" | "retrieve" | "switchToUserInput" | "close";

/**
 * OpenAI Assistant chat actions
 */
export type OpenAiChatActions = ReadonlyArray<OpenAiChatAction>;
