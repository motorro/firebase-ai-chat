import { AssistantChat, AiWrapper, ToolsDispatcher, ChatData, ChatState } from "@motorro/firebase-ai-chat-core";
import { ChatWorker } from "./aichat/ChatWorker";
import { Functions } from "firebase-admin/lib/functions";
import { firestore } from "firebase-admin";
import Firestore = firestore.Firestore;
import { OpenAiAssistantConfig } from "./aichat/data/OpenAiAssistantConfig";
export { ChatData, ChatState, ChatStatus, ChatMessage, Meta, Logger, setLogger, TaskScheduler, Collections } from "@motorro/firebase-ai-chat-core";
export { AiWrapper, ChatWorker, ToolsDispatcher, AssistantChat };
export { OpenAiWrapper } from "./aichat/OpenAiWrapper";
export { OpenAiAssistantConfig } from "./aichat/data/OpenAiAssistantConfig";
export { OpenAiChatCommand } from "./aichat/data/OpenAiChatCommand";
/**
 * Chat state for OpenAI chats
 */
export type OpenAiChatState<DATA extends ChatData> = ChatState<OpenAiAssistantConfig, DATA>;
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
    chat<DATA extends ChatData>(queueName: string): AssistantChat<OpenAiAssistantConfig, DATA>;
    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @param dispatchers Tools dispatchers
     * @return Worker interface
     */
    worker(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker;
}
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @return Chat tools interface
 */
export declare function factory(firestore: Firestore, functions: Functions, location: string): AiChat;
