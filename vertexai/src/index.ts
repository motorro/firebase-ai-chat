import {
    AssistantChat,
    ToolsDispatcher,
    FirebaseQueueTaskScheduler,
    ChatData,
    ChatState,
    TaskScheduler,
    CommandScheduler
} from "@motorro/firebase-ai-chat-core";
import {VertexAiChatWorker} from "./aichat/VertexAiChatWorker";
import {Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import {VertexAiAssistantConfig} from "./aichat/data/VertexAiAssistantConfig";
import {VertexAICommandScheduler} from "./aichat/VertexAICommandScheduler";
import {AiWrapper} from "./aichat/AiWrapper";
import {VertexAiSystemInstructions} from "./aichat/data/VertexAiSystemInstructions";
import {GenerativeModel} from "@google-cloud/vertexai";
import {VertexAiWrapper} from "./aichat/VertexAiWrapper";

export {
    ChatData,
    ChatState,
    ChatStatus,
    ChatMessage,
    Meta,
    Logger,
    setLogger,
    TaskScheduler,
    CommandScheduler,
    Collections,
    SystemInstructions,
    AiExample,
    AiResponseExample,
    AiFunctionCallExample,
    printAiExample
} from "@motorro/firebase-ai-chat-core";
export {
    AiWrapper,
    VertexAiChatWorker,
    ToolsDispatcher,
    AssistantChat,
    VertexAiSystemInstructions,
};
export {VertexAiTools} from "./aichat/data/VertexAiSystemInstructions";
export {VertexAiAssistantConfig} from "./aichat/data/VertexAiAssistantConfig";
export {VertexAiChatCommand} from "./aichat/data/VertexAiChatCommand";

/**
 * Chat state for VertexAI chats
 */
export type VertexAiChatState<DATA extends ChatData> = ChatState<VertexAiAssistantConfig, DATA>

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
    createDefaultCommandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler>

    /**
     * Chat user-facing callable functions
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @return Chat interface
     * @see worker
     */
    chat<DATA extends ChatData>(queueName: string): AssistantChat<DATA>

    /**
     * Creates AI wrapper that runs AI requests
     * @param model Common model setup
     * @param threadsPath Firestore path for internal thread data storage
     * @return Instance of AI wrapper
     * @see worker
     */
    ai(model: GenerativeModel, threadsPath: string): AiWrapper

    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @param instructions Model instructions
     * @return Worker interface
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    worker(aiWrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>): VertexAiChatWorker
}

/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Chat tools interface
 */
export function factory(
    firestore: Firestore,
    functions: Functions,
    location: string,
    taskScheduler?: TaskScheduler
): AiChat {
    const _taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);

    function defaultSchedulers(queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> {
        return [new VertexAICommandScheduler(queueName, taskScheduler)];
    }

    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function<DATA extends ChatData>(queueName: string): AssistantChat<DATA> {
            return new AssistantChat<DATA>(firestore, new VertexAICommandScheduler(queueName, _taskScheduler));
        },
        ai(model: GenerativeModel, threadsPath: string): AiWrapper {
            return new VertexAiWrapper(model, firestore, threadsPath);
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function(aiWrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>): VertexAiChatWorker {
            return new VertexAiChatWorker(firestore, _taskScheduler, aiWrapper, instructions);
        }
    };
}
