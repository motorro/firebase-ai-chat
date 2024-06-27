import { ChatData, ChatMessage, ChatState } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../src";
import { Tool } from "@google-cloud/vertexai/src/types/content";
export declare const NAME = "Chat";
export declare const CHATS = "chats";
export interface Data extends ChatData {
    readonly value: string;
}
export interface Data2 extends ChatData {
    readonly value: string;
}
export declare const runId = "run-1";
export declare const userId = "123456";
export declare const threadId = "thread123";
export declare const instructionsId = "instructions1";
export declare const userMessage: ChatMessage;
export declare const aiMessage: ChatMessage;
export declare const data: Data;
export declare const data2: Data;
export declare const chatState: ChatState<VertexAiAssistantConfig, Data>;
export declare const instructions1 = "You are number 1 assistant";
export declare const instructions2 = "You are number 2 assistant";
export declare const toolsDefinition: Array<Tool>;
