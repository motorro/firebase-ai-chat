import {OpenAiChatActions} from "./OpenAiChatAction";
import {ChatCommand} from "@motorro/firebase-ai-chat-core";

export interface OpenAiChatCommand extends ChatCommand<OpenAiChatActions> {
    readonly engine: "openai"
}
