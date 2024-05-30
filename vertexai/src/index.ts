import {
    AssistantChat,
    ChatData,
    ChatWorker,
    CommandScheduler,
    FirebaseQueueTaskScheduler,
    TaskScheduler,
    ToolsContinuationScheduler,
    toolContinuationSchedulerFactory
} from "@motorro/firebase-ai-chat-core";
import {Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import {VertexAICommandScheduler} from "./aichat/VertexAICommandScheduler";
import {AiWrapper} from "./aichat/AiWrapper";
import {VertexAiSystemInstructions} from "./aichat/data/VertexAiSystemInstructions";
import {GenerativeModel} from "@google-cloud/vertexai";
import {VertexAiWrapper} from "./aichat/VertexAiWrapper";
import {VertexAiChatWorker} from "./aichat/VertexAiChatWorker";
import Firestore = firestore.Firestore;

export {
    AssistantChat,
    ChatData,
    ChatState,
    ChatStatus,
    ChatMessage,
    Meta,
    ChatMeta,
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
    VertexAiSystemInstructions
};
export {VertexAiTools} from "./aichat/data/VertexAiSystemInstructions";
export {VertexAiAssistantConfig} from "./aichat/data/VertexAiAssistantConfig";
export {VertexAiChatCommand} from "./aichat/data/VertexAiChatCommand";
export {VertexAiChatState} from "./aichat/data/VertexAiChatState";

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
     * @param model Common model setup
     * @param threadsPath Firestore path for internal thread data storage
     * @param instructions Model instructions
     * @return Worker interface
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    worker(model: GenerativeModel, threadsPath: string, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>): ChatWorker

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
 * @return Chat tools interface
 */
export function factory(
    firestore: Firestore,
    functions: Functions,
    location: string,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    taskScheduler?: TaskScheduler
): AiChat {
    const _taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);
    const _continuationSchedulerFactory = toolContinuationSchedulerFactory(firestore, _taskScheduler);

    function defaultSchedulers(queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> {
        return [new VertexAICommandScheduler(queueName, taskScheduler)];
    }

    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function<DATA extends ChatData>(queueName: string): AssistantChat<DATA> {
            return new AssistantChat<DATA>(firestore, new VertexAICommandScheduler(queueName, _taskScheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function(model: GenerativeModel, threadsPath: string, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>): ChatWorker {
            return new VertexAiChatWorker(
                firestore,
                _taskScheduler,
                new VertexAiWrapper(model, firestore, threadsPath),
                instructions
            );
        },
        continuationScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA> {
            return _continuationSchedulerFactory.create(queueName);
        }
    };
}
