import { VertexAiChatActions } from "./VertexAiChatAction";
import { ChatCommand } from "@motorro/firebase-ai-chat-core";
export interface VertexAiChatCommand extends ChatCommand<VertexAiChatActions> {
    readonly engine: "vertexai";
}
