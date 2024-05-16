import { AssistantChat, ToolsDispatcher, ChatData, ChatState, TaskScheduler, CommandScheduler } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "./aichat/AiWrapper";
import { OpenAiChatWorker } from "./aichat/OpenAiChatWorker";
import { Functions } from "firebase-admin/lib/functions";
import { firestore } from "firebase-admin";
import Firestore = firestore.Firestore;
import { OpenAiAssistantConfig } from "./aichat/data/OpenAiAssistantConfig";
import OpenAI from "openai";
export { AssistantChat, ChatData, ChatState, ChatStatus, ChatMessage, Meta, Logger, setLogger, TaskScheduler, CommandScheduler, Collections, SystemInstructions, AiExample, AiResponseExample, AiFunctionCallExample, printAiExample } from "@motorro/firebase-ai-chat-core";
export { DispatchSuccess, DispatchError, DispatchResult, ToolsDispatcher, isDispatchResult, getDispatchError, isDispatchError, getDispatchSuccess, isDispatchSuccess } from "@motorro/firebase-ai-chat-core";
export { ChatCommand, BoundChatCommand, isChatCommand, isBoundChatCommand } from "@motorro/firebase-ai-chat-core";
export { FirebaseQueueTaskScheduler } from "@motorro/firebase-ai-chat-core";
export { Continuation, SuspendedContinuation, ResolvedContinuation } from "@motorro/firebase-ai-chat-core";
export { ContinuationRequest, ContinuationCommand, ToolCall, ContinuationRequestToolData, ToolCallRequest, ToolCallResponse, ToolCallsResult, isContinuationRequest, isContinuationCommand, isContinuationCommandRequest } from "@motorro/firebase-ai-chat-core";
export { AiWrapper, OpenAiChatWorker };
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
     * Creates default command scheduler that schedules commands to dispatch
     * @param queueName Provides queue name to schedule tasks to
     * @param taskScheduler Provides task-schedule to put tasks to queue
     * @return Array of default task schedulers for this library
     */
    createDefaultCommandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler>;
    /**
     * Chat user-facing callable functions
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @return Chat interface
     * @see worker
     */
    chat<DATA extends ChatData>(queueName: string): AssistantChat<DATA>;
    /**
     * Creates AI wrapper that runs AI requests
     * @param openAi OpenAI instance
     * @param dispatchers Tools dispatchers
     * @return Instance of AI wrapper
     * @see worker
     */
    ai(openAi: OpenAI, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): AiWrapper;
    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @return Worker interface
     */
    worker(aiWrapper: AiWrapper): OpenAiChatWorker;
}
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param dispatchers Tools dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Chat tools interface
 */
export declare function factory(firestore: Firestore, functions: Functions, location: string, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, taskScheduler?: TaskScheduler): AiChat;
