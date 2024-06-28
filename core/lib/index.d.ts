import { ToolContinuationDispatcherFactory } from "./aichat/workers/ToolContinuationDispatcherFactory";
import { TaskScheduler } from "./aichat/TaskScheduler";
import { ToolsContinuationSchedulerFactory } from "./aichat/workers/ToolsContinuationScheduler";
import { ToolCallRequest } from "./aichat/data/ContinuationCommand";
import { DispatchError, ToolsDispatcher } from "./aichat/ToolsDispatcher";
import { commonFormatContinuationError } from "./aichat/workers/ToolsContinuationDispatchRunner";
export { AiError, isPermanentError, AiExample, AiResponseExample, AiFunctionCallExample, SystemInstructions, printAiExample } from "./aichat/data/AiData";
export { AssistantConfig, ChatData, ChatState, ChatStatus } from "./aichat/data/ChatState";
export { ChatCommandData } from "./aichat/data/ChatCommandData";
export { ChatMessage } from "./aichat/data/ChatMessage";
export { ChatError } from "./aichat/data/ChatError";
export { Dispatch, Run, RunStatus } from "./aichat/data/Dispatch";
export { Meta, ChatMeta } from "./aichat/data/Meta";
export { Logger, logger, setLogger, tagLogger } from "./logging";
export { ChatDispatchData, FunctionSuccessResult, FunctionSuccess, ReducerSuccess, DispatchError, DispatchResult, ToolDispatcherReturnValue, ToolsDispatcher, isDispatchResult, getDispatchError, isDispatchError, getFunctionSuccess, getReducerSuccess, isFunctionSuccess, isReducerSuccess } from "./aichat/ToolsDispatcher";
export { AssistantChat } from "./aichat/AssistantChat";
export { HandOverResult } from "./aichat/data/HandOverResult";
export { DispatchControl, ChatWorker } from "./aichat/workers/ChatWorker";
export { BaseChatWorker } from "./aichat/workers/BaseChatWorker";
export { DispatchRunner } from "./aichat/workers/DispatchRunner";
export { ToolContinuationDispatcherFactory } from "./aichat/workers/ToolContinuationDispatcherFactory";
export { ToolsContinuationScheduler } from "./aichat/workers/ToolsContinuationScheduler";
export { ToolsContinuationDispatcher } from "./aichat/workers/ToolsContinuationDispatcher";
export { CommandScheduler } from "./aichat/CommandScheduler";
export { TaskScheduler } from "./aichat/TaskScheduler";
export { ChatCommand, BoundChatCommand, isChatCommand, isBoundChatCommand } from "./aichat/data/ChatCommand";
export { FirebaseQueueTaskScheduler } from "./aichat/FirebaseQueueTaskScheduler";
export { Collections } from "./aichat/data/Collections";
export { Continuation, SuspendedContinuation, ResolvedContinuation } from "./aichat/data/Continuation";
export { ContinuationRequest, ContinuationCommand, ToolCall, ContinuationRequestToolData, ToolCallRequest, ToolCallResponse, ToolCallsResult, isContinuationRequest, isContinuationCommand, isContinuationCommandRequest } from "./aichat/data/ContinuationCommand";
export { commonFormatContinuationError };
export { NewMessage, StructuredMessage, isStructuredMessage } from "./aichat/data/NewMessage";
export { ChatCleaner, ChatCleanupRegistrar, CommonChatCleaner, CommonChatCleanupRegistrar } from "./aichat/workers/ChatCleaner";
export { PartialChatState, MessageProcessingControl, MessageMiddleware } from "./aichat/middleware/MessageMiddleware";
export { HandOverControl, handOverMiddleware } from "./aichat/middleware/handOverMiddleware";
/**
 * Tools continuation dispatcher factory
 * @param db Firestore
 * @param dispatchers Tool dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param formatContinuationError Formats continuation error
 * @param logData If true, logs data when dispatching
 * @return Continuation tools factory
 */
export declare function toolContinuationDispatcherFactory(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, taskScheduler: TaskScheduler, formatContinuationError?: (failed: ToolCallRequest, error: DispatchError) => DispatchError, logData?: boolean): ToolContinuationDispatcherFactory;
/**
 * Tools continuation scheduler factory
 * @param db Firestore
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param logData If true, logs data when dispatching
 * @return Continuation scheduler factory
 */
export declare function toolContinuationSchedulerFactory(db: FirebaseFirestore.Firestore, taskScheduler: TaskScheduler, logData?: boolean): ToolsContinuationSchedulerFactory;
