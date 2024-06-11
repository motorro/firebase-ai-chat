import {
    AssistantChat,
    ToolsDispatcher,
    FirebaseQueueTaskScheduler,
    ChatData,
    ChatState,
    TaskScheduler,
    CommandScheduler,
    ToolsContinuationScheduler,
    toolContinuationSchedulerFactory, toolContinuationDispatcherFactory
} from "@motorro/firebase-ai-chat-core";
import {AiWrapper} from "./aichat/AiWrapper";
import {OpenAiChatWorker} from "./aichat/OpenAiChatWorker";
import {Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import {OpenAiAssistantConfig} from "./aichat/data/OpenAiAssistantConfig";
import {OpenAICommandScheduler} from "./aichat/OpenAICommandScheduler";
import OpenAI from "openai";
import {OpenAiWrapper} from "./aichat/OpenAiWrapper";

export {
    AssistantChat,
    HandOverResult,
    ChatData,
    ChatState,
    ChatStatus,
    ChatMessage,
    Meta,
    ChatMeta,
    Logger,
    setLogger,
    tagLogger,
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
    ChatDispatchData,
    FunctionSuccess,
    ReducerSuccess,
    DispatchError,
    DispatchResult,
    ToolDispatcherReturnValue,
    ToolsDispatcher,
    isDispatchResult,
    getDispatchError,
    isDispatchError,
    getFunctionSuccess,
    getReducerSuccess,
    isFunctionSuccess,
    isReducerSuccess
} from "@motorro/firebase-ai-chat-core";
export {ChatCommand, BoundChatCommand, isChatCommand, isBoundChatCommand} from "@motorro/firebase-ai-chat-core";
export {FirebaseQueueTaskScheduler} from "@motorro/firebase-ai-chat-core";
export {Continuation, SuspendedContinuation, ResolvedContinuation} from "@motorro/firebase-ai-chat-core";
export {
    ContinuationRequest,
    ContinuationCommand,
    ToolCall,
    ContinuationRequestToolData,
    ToolCallRequest,
    ToolCallResponse,
    ToolCallsResult,
    isContinuationRequest,
    isContinuationCommand,
    isContinuationCommandRequest
} from "@motorro/firebase-ai-chat-core";

export {
    AiWrapper,
    OpenAiChatWorker
};
export {OpenAiAssistantConfig} from "./aichat/data/OpenAiAssistantConfig";
export {OpenAiChatCommand, isOpenAiChatReq, isOpenAiChatCommand} from "./aichat/data/OpenAiChatCommand";

/**
 * Chat state for OpenAI chats
 */
export type OpenAiChatState<DATA extends ChatData> = ChatState<OpenAiAssistantConfig, DATA>

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
     * Chat worker to use in Firebase tasks
     * @param openAi OpenAI instance
     * @param dispatchers Tools dispatchers
     * @return Worker interface
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    worker(openAi: OpenAI, dispatchers: Readonly<Record<string, ToolsDispatcher<any, any>>>): OpenAiChatWorker

    /**
     * Creates a tool continuation scheduler to continue tools dispatch
     * @param queueName The name of the queue the dispatch will be continued on
     * @returns Continuation scheduler to resume tools dispatch
     */
    continuationScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>
}

/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param debugAi If true, raw AI input and output will be logged
 * @return Chat tools interface
 */
export function factory(
    firestore: Firestore,
    functions: Functions,
    location: string,
    taskScheduler?: TaskScheduler,
    debugAi = false
): AiChat {
    const _taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);
    const _continuationSchedulerFactory = toolContinuationSchedulerFactory(firestore, _taskScheduler);

    function defaultSchedulers(queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> {
        return [new OpenAICommandScheduler(queueName, taskScheduler)];
    }

    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function<DATA extends ChatData>(
            queueName: string,
            commandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler> = defaultSchedulers
        ): AssistantChat<DATA> {
            return new AssistantChat<DATA>(firestore, commandSchedulers(queueName, _taskScheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker(openAi: OpenAI, dispatchers: Readonly<Record<string, ToolsDispatcher<any, any>>>): OpenAiChatWorker {
            return new OpenAiChatWorker(
                firestore,
                _taskScheduler,
                new OpenAiWrapper(openAi, debugAi),
                toolContinuationDispatcherFactory(firestore, dispatchers, _taskScheduler)
            );
        },
        continuationScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA> {
            return _continuationSchedulerFactory.create(queueName);
        }
    };
}
