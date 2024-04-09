import { OpenAiChatAction } from "./OpenAiChatAction";
import { ChatCommand } from "@motorro/firebase-ai-chat-core";
export interface OpenAiChatCommand extends ChatCommand<OpenAiChatAction> {
    readonly engine: "openai";
}
