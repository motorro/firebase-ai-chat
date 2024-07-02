import {
    AssistantChat,
    ChatData,
    ChatWorker,
    CommandScheduler,
    FirebaseQueueTaskScheduler,
    TaskScheduler,
    ToolsContinuationScheduler,
    toolContinuationSchedulerFactory,
    ToolCallRequest,
    DispatchError,
    commonFormatContinuationError,
    ChatCleaner,
    CommonChatCleaner,
    CommonChatCleanupRegistrar,
    MessageMiddleware,
    AssistantConfig,
    HandOverControl,
    NewMessage,
    Meta,
    ChatMeta,
    ChatState,
    handOverMiddleware
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
import {VertexAiMessageMapper} from "./aichat/VertexAiMessageMapper";

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
    FunctionSuccessResult,
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
    isReducerSuccess,
    NewMessage,
    StructuredMessage,
    isStructuredMessage,
    ChatCleaner
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
export {PartialChatState, MessageProcessingControl, MessageMiddleware} from "@motorro/firebase-ai-chat-core";
export {HandOverData, HandOverDelegate} from "@motorro/firebase-ai-chat-core";
export {HandOverControl, handOverMiddleware} from "@motorro/firebase-ai-chat-core";

export {
    AiWrapper,
    VertexAiSystemInstructions,
    VertexAiMessageMapper
};
export {VertexAiTools} from "./aichat/data/VertexAiSystemInstructions";
export {VertexAiAssistantConfig} from "./aichat/data/VertexAiAssistantConfig";
export {VertexAiChatCommand, isVertexAiChatReq, isVertexAiChatCommand} from "./aichat/data/VertexAiChatCommand";
export {VertexAiChatState} from "./aichat/data/VertexAiChatState";
export {DefaultVertexAiMessageMapper} from "./aichat/VertexAiMessageMapper";


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
     * @param commandSchedulers Creates a list of command schedulers. Should return schedulers for each platform
     * @param chatCleaner Optional chat resource cleaner extension
     * @return Chat interface
     * @see worker
     * @see createDefaultCommandSchedulers
     */
    chat<DATA extends ChatData>(
        queueName: string,
        commandSchedulers?: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler>,
        chatCleaner?: ChatCleaner
    ): AssistantChat<DATA>

    /**
     * Creates chat hand-over message middleware
     * Add it to the worker to custom-process messages coming from AI
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @param process Processing function
     * @param commandSchedulers Creates a list of command schedulers. Should return schedulers for each platform
     * @return Message middleware with handover functions
     * @see worker
     */
    handOverMiddleware<DATA extends ChatData, CM extends ChatMeta = ChatMeta, WM extends Meta = Meta>(
        queueName: string,
        process: (
            messages: ReadonlyArray<NewMessage>,
            chatDocumentPath: string,
            chatState: ChatState<AssistantConfig, DATA, CM>,
            control: HandOverControl<DATA, WM, CM>
        ) => Promise<void>,
        commandSchedulers?: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler>,
    ): MessageMiddleware<DATA, CM>

    /**
     * Chat worker to use in Firebase tasks
     * @param model Common model setup
     * @param threadsPath Firestore path for internal thread data storage
     * @param instructions Model instructions
     * @param messageMapper Maps messages to/from VertexAI
     * @param chatCleaner Optional chat resource cleaner extension
     * @param messageMiddleware Optional Message processing middleware
     * @return Worker interface
     */
    worker(
        model: GenerativeModel,
        threadsPath: string,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any, any>>>,
        messageMapper?: VertexAiMessageMapper,
        chatCleaner?: ChatCleaner,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        messageMiddleware?: ReadonlyArray<MessageMiddleware<any, any>>
    ): ChatWorker

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
 * @param formatContinuationError Formats continuation error for AI
 * @param debugAi If true, raw AI input and output will be logged
 * @param logData If true, logs chat data * @return Chat tools interface
 * @returns AiChat instance
 */
export function factory(
    firestore: Firestore,
    functions: Functions,
    location: string,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    taskScheduler?: TaskScheduler,
    formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError = commonFormatContinuationError,
    debugAi = false,
    logData = false,
): AiChat {
    const _taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);
    const _continuationSchedulerFactory = toolContinuationSchedulerFactory(firestore, _taskScheduler);
    const _chatCleanupRegistrar = new CommonChatCleanupRegistrar(firestore);
    const _chatCleanerFactory = (queueName: string, chatCleaner?: ChatCleaner) => {
        const commonCleaner = new CommonChatCleaner(firestore, _taskScheduler, queueName);
        return undefined === chatCleaner ? commonCleaner : {
            cleanup: async (chatDocumentPath: string) => {
                await commonCleaner.cleanup(chatDocumentPath);
                await chatCleaner.cleanup(chatDocumentPath);
            }
        };
    };

    function defaultSchedulers(queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> {
        return [new VertexAICommandScheduler(queueName, taskScheduler)];
    }

    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function<DATA extends ChatData>(
            queueName: string,
            commandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler> = defaultSchedulers,
            chatCleaner?: ChatCleaner
        ): AssistantChat<DATA> {
            return new AssistantChat<DATA>(
                firestore,
                commandSchedulers(queueName, _taskScheduler),
                _chatCleanerFactory(queueName, chatCleaner)
            );
        },
        handOverMiddleware<DATA extends ChatData, CM extends ChatMeta = ChatMeta, WM extends Meta = Meta>(
            queueName: string,
            process: (
                messages: ReadonlyArray<NewMessage>,
                chatDocumentPath: string,
                chatState: ChatState<AssistantConfig, DATA, CM>,
                control: HandOverControl<DATA, WM, CM>
            ) => Promise<void>,
            commandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler> = defaultSchedulers,
        ): MessageMiddleware<DATA, CM> {
            return handOverMiddleware(firestore, commandSchedulers(queueName, _taskScheduler), process);
        },
        worker: function(
            model: GenerativeModel,
            threadsPath: string,
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            instructions: Readonly<Record<string, VertexAiSystemInstructions<any, any>>>,
            messageMapper?: VertexAiMessageMapper,
            chatCleaner?: ChatCleaner,
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            messageMiddleware?: ReadonlyArray<MessageMiddleware<any, any>>
        ): ChatWorker {
            return new VertexAiChatWorker(
                firestore,
                _taskScheduler,
                new VertexAiWrapper(model, firestore, threadsPath, debugAi, messageMapper),
                instructions,
                formatContinuationError,
                _chatCleanupRegistrar,
                (queueName) => _chatCleanerFactory(queueName, chatCleaner),
                logData,
                messageMiddleware || []
            );
        },
        continuationScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA> {
            return _continuationSchedulerFactory.create(queueName);
        }
    };
}
