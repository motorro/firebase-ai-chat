import {ToolContinuationDispatcherFactory, ToolContinuationDispatcherFactoryImpl} from "./aichat/workers/ToolContinuationDispatcherFactory";
import {ToolsDispatcher} from "./aichat/ToolsDispatcher";
import {TaskScheduler} from "./aichat/TaskScheduler";
import {
    ToolsContinuationSchedulerFactory,
    ToolsContinuationSchedulerFactoryImpl
} from "./aichat/workers/ToolsContinuationScheduler";

export {
    Messages,
    AiError,
    isPermanentError,
    AiExample,
    AiResponseExample,
    AiFunctionCallExample,
    SystemInstructions,
    printAiExample
} from "./aichat/data/AiData";
export {AssistantConfig, ChatData, ChatState, ChatStatus} from "./aichat/data/ChatState";
export {ChatCommandData} from "./aichat/data/ChatCommandData";
export {ChatMessage} from "./aichat/data/ChatMessage";
export {ChatError} from "./aichat/data/ChatError";
export {Dispatch, Run, RunStatus} from "./aichat/data/Dispatch";
export {Meta, ChatMeta} from "./aichat/data/Meta";
export {Logger, logger, setLogger} from "./logging";
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
} from "./aichat/ToolsDispatcher";
export {AssistantChat} from "./aichat/AssistantChat";
export {DispatchControl, ChatWorker} from "./aichat/workers/ChatWorker";
export {BaseChatWorker} from "./aichat/workers/BaseChatWorker";
export {DispatchRunner} from "./aichat/workers/DispatchRunner";
export {ToolContinuationDispatcherFactory} from "./aichat/workers/ToolContinuationDispatcherFactory";
export {ToolsContinuationScheduler} from "./aichat/workers/ToolsContinuationScheduler";
export {ToolsContinuationDispatcher} from "./aichat/workers/ToolsContinuationDispatcher";
export {CommandScheduler} from "./aichat/CommandScheduler";
export {TaskScheduler} from "./aichat/TaskScheduler";
export {ChatCommand, BoundChatCommand, isChatCommand, isBoundChatCommand} from "./aichat/data/ChatCommand";
export {FirebaseQueueTaskScheduler} from "./aichat/FirebaseQueueTaskScheduler";
export {Collections} from "./aichat/data/Collections";
export {Continuation, SuspendedContinuation, ResolvedContinuation} from "./aichat/data/Continuation";
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
} from "./aichat/data/ContinuationCommand";

/**
 * Tools continuation dispatcher factory
 * @param db Firestore
 * @param dispatchers Tool dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Continuation tools factory
 */
export function toolContinuationDispatcherFactory(
    db: FirebaseFirestore.Firestore,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>,
    taskScheduler: TaskScheduler,
): ToolContinuationDispatcherFactory {
    return new ToolContinuationDispatcherFactoryImpl(db, dispatchers, taskScheduler);
}

/**
 * Tools continuation scheduler factory
 * @param db Firestore
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Continuation scheduler factory
 */
export function toolContinuationSchedulerFactory(
    db: FirebaseFirestore.Firestore,
    taskScheduler: TaskScheduler
): ToolsContinuationSchedulerFactory {
    return new ToolsContinuationSchedulerFactoryImpl(db, taskScheduler);
}
