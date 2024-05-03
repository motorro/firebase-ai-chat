import { AssistantChat, ToolsDispatcher, ChatData, ChatState } from "@motorro/firebase-ai-chat-core";
import { VertexAiChatWorker } from "./aichat/VertexAiChatWorker";
import { Functions } from "firebase-admin/lib/functions";
import { firestore } from "firebase-admin";
import Firestore = firestore.Firestore;
import { VertexAiAssistantConfig } from "./aichat/data/VertexAiAssistantConfig";
import { AiWrapper } from "./aichat/AiWrapper";
import { VertexAiSystemInstructions } from "./aichat/data/VertexAiSystemInstructions";
import { GenerativeModel } from "@google-cloud/vertexai";
export { ChatData, ChatState, ChatStatus, ChatMessage, Meta, Logger, setLogger, TaskScheduler, Collections } from "@motorro/firebase-ai-chat-core";
export { AiWrapper, VertexAiChatWorker, ToolsDispatcher, AssistantChat, VertexAiSystemInstructions };
export { VertexAiAssistantConfig } from "./aichat/data/VertexAiAssistantConfig";
export { VertexAiChatCommand } from "./aichat/data/VertexAiChatCommand";
/**
 * Chat state for VertexAI chats
 */
export type VertexAiChatState<DATA extends ChatData> = ChatState<VertexAiAssistantConfig, DATA>;
/**
 * AI chat components to build Firestore functions
 */
export interface AiChat {
    /**
     * Chat user-facing callable functions
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @return Chat interface
     * @see worker
     */
    chat<DATA extends ChatData>(queueName: string): AssistantChat<DATA>;
    /**
     * Creates AI wrapper that runs AI requests
     * @param model Common model setup
     * @param threadsPath Firestore path for internal thread data storage
     * @return Instance of AI wrapper
     * @see worker
     */
    ai(model: GenerativeModel, threadsPath: string): AiWrapper;
    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @param instructions Model instructions
     * @return Worker interface
     */
    worker(aiWrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>): VertexAiChatWorker;
}
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @return Chat tools interface
 */
export declare function factory(firestore: Firestore, functions: Functions, location: string): AiChat;
