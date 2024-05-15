import { ToolContinuationFactory } from "./aichat/workers/ToolContinuationFactory";
import { ToolsDispatcher } from "./aichat/ToolsDispatcher";
import { TaskScheduler } from "./aichat/TaskScheduler";
export { Messages, AiError, isPermanentError, AiExample, AiResponseExample, AiFunctionCallExample, SystemInstructions, printAiExample } from "./aichat/data/AiData";
export { AssistantConfig, ChatData, ChatState, ChatStatus } from "./aichat/data/ChatState";
export { ChatCommandData } from "./aichat/data/ChatCommandData";
export { ChatMessage } from "./aichat/data/ChatMessage";
export { ChatError } from "./aichat/data/ChatError";
export { Dispatch, Run, RunStatus } from "./aichat/data/Dispatch";
export { Meta } from "./aichat/data/Meta";
export { Logger, logger, setLogger } from "./logging";
export { DispatchSuccess, DispatchError, DispatchResult, ToolsDispatcher, isDispatchResult, getDispatchError, isDispatchError, getDispatchSuccess, isDispatchSuccess } from "./aichat/ToolsDispatcher";
export { AssistantChat } from "./aichat/AssistantChat";
export { DispatchControl, ChatWorker } from "./aichat/workers/ChatWorker";
export { BaseChatWorker } from "./aichat/workers/BaseChatWorker";
export { DispatchRunner } from "./aichat/workers/DispatchRunner";
export { ToolContinuationFactory } from "./aichat/workers/ToolContinuationFactory";
export { ToolsContinuation } from "./aichat/workers/ToolsContinuation";
export { ToolsContinuationDispatcher } from "./aichat/workers/ToolsContinuationDispatcher";
export { CommandScheduler } from "./aichat/CommandScheduler";
export { TaskScheduler } from "./aichat/TaskScheduler";
export { ChatCommand, BoundChatCommand, isBoundChatCommand } from "./aichat/data/ChatCommand";
export { FirebaseQueueTaskScheduler } from "./aichat/FirebaseQueueTaskScheduler";
export { Collections } from "./aichat/data/Collections";
export { Continuation, SuspendedContinuation, ResolvedContinuation } from "./aichat/data/Continuation";
export { ContinuationRequest, ContinuationCommand, BoundContinuationCommand, ToolCall, ToolCallRequest, ToolCallResponse, ToolCallsResult, isContinuationRequest, isContinuationCommand, isContinuationCommandRequest } from "./aichat/data/ContinuationCommand";
/**
 * Tools continuation components factory
 * @param db Firestore
 * @param dispatchers Tool dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Continuation tools factory
 */
export declare function toolContinuationFactory(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, taskScheduler: TaskScheduler): ToolContinuationFactory;
