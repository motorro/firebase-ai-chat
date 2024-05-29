import {ChatData, ChatState} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "./VertexAiAssistantConfig";

/**
 * Chat state for VertexAI chats
 */
export type VertexAiChatState<DATA extends ChatData> = ChatState<VertexAiAssistantConfig, DATA>
