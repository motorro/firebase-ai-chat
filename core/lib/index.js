"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandBackWorker = exports.HandOverWorker = exports.isHandBackAction = exports.isHandOverAction = exports.handOverMiddleware = exports.HandOverDelegate = exports.CommonChatCleanupRegistrar = exports.CommonChatCleaner = exports.isStructuredMessage = exports.commonFormatContinuationError = exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = exports.ResolvedContinuation = exports.SuspendedContinuation = exports.Continuation = exports.Collections = exports.FirebaseQueueTaskScheduler = exports.isBoundChatCommand = exports.isChatCommand = exports.hasHandOver = exports.DispatchRunner = exports.BaseChatWorker = exports.AssistantChat = exports.isReducerSuccess = exports.isFunctionSuccess = exports.getReducerSuccess = exports.getFunctionSuccess = exports.isDispatchError = exports.getDispatchError = exports.isDispatchResult = exports.tagLogger = exports.setLogger = exports.logger = exports.ChatError = exports.printAiExample = exports.isPermanentError = void 0;
exports.toolContinuationDispatcherFactory = toolContinuationDispatcherFactory;
exports.toolContinuationSchedulerFactory = toolContinuationSchedulerFactory;
const ToolContinuationDispatcherFactory_1 = require("./aichat/workers/ToolContinuationDispatcherFactory");
const ToolsContinuationScheduler_1 = require("./aichat/workers/ToolsContinuationScheduler");
const ToolsContinuationDispatchRunner_1 = require("./aichat/workers/ToolsContinuationDispatchRunner");
Object.defineProperty(exports, "commonFormatContinuationError", { enumerable: true, get: function () { return ToolsContinuationDispatchRunner_1.commonFormatContinuationError; } });
var AiData_1 = require("./aichat/data/AiData");
Object.defineProperty(exports, "isPermanentError", { enumerable: true, get: function () { return AiData_1.isPermanentError; } });
Object.defineProperty(exports, "printAiExample", { enumerable: true, get: function () { return AiData_1.printAiExample; } });
var ChatError_1 = require("./aichat/data/ChatError");
Object.defineProperty(exports, "ChatError", { enumerable: true, get: function () { return ChatError_1.ChatError; } });
var logging_1 = require("./logging");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logging_1.logger; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return logging_1.setLogger; } });
Object.defineProperty(exports, "tagLogger", { enumerable: true, get: function () { return logging_1.tagLogger; } });
var ToolsDispatcher_1 = require("./aichat/ToolsDispatcher");
Object.defineProperty(exports, "isDispatchResult", { enumerable: true, get: function () { return ToolsDispatcher_1.isDispatchResult; } });
Object.defineProperty(exports, "getDispatchError", { enumerable: true, get: function () { return ToolsDispatcher_1.getDispatchError; } });
Object.defineProperty(exports, "isDispatchError", { enumerable: true, get: function () { return ToolsDispatcher_1.isDispatchError; } });
Object.defineProperty(exports, "getFunctionSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.getFunctionSuccess; } });
Object.defineProperty(exports, "getReducerSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.getReducerSuccess; } });
Object.defineProperty(exports, "isFunctionSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.isFunctionSuccess; } });
Object.defineProperty(exports, "isReducerSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.isReducerSuccess; } });
var AssistantChat_1 = require("./aichat/AssistantChat");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return AssistantChat_1.AssistantChat; } });
var BaseChatWorker_1 = require("./aichat/workers/BaseChatWorker");
Object.defineProperty(exports, "BaseChatWorker", { enumerable: true, get: function () { return BaseChatWorker_1.BaseChatWorker; } });
var DispatchRunner_1 = require("./aichat/workers/DispatchRunner");
Object.defineProperty(exports, "DispatchRunner", { enumerable: true, get: function () { return DispatchRunner_1.DispatchRunner; } });
var ToolsContinuationDispatcher_1 = require("./aichat/workers/ToolsContinuationDispatcher");
Object.defineProperty(exports, "hasHandOver", { enumerable: true, get: function () { return ToolsContinuationDispatcher_1.hasHandOver; } });
var ChatCommand_1 = require("./aichat/data/ChatCommand");
Object.defineProperty(exports, "isChatCommand", { enumerable: true, get: function () { return ChatCommand_1.isChatCommand; } });
Object.defineProperty(exports, "isBoundChatCommand", { enumerable: true, get: function () { return ChatCommand_1.isBoundChatCommand; } });
var FirebaseQueueTaskScheduler_1 = require("./aichat/FirebaseQueueTaskScheduler");
Object.defineProperty(exports, "FirebaseQueueTaskScheduler", { enumerable: true, get: function () { return FirebaseQueueTaskScheduler_1.FirebaseQueueTaskScheduler; } });
var Collections_1 = require("./aichat/data/Collections");
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return Collections_1.Collections; } });
var Continuation_1 = require("./aichat/data/Continuation");
Object.defineProperty(exports, "Continuation", { enumerable: true, get: function () { return Continuation_1.Continuation; } });
Object.defineProperty(exports, "SuspendedContinuation", { enumerable: true, get: function () { return Continuation_1.SuspendedContinuation; } });
Object.defineProperty(exports, "ResolvedContinuation", { enumerable: true, get: function () { return Continuation_1.ResolvedContinuation; } });
var ContinuationCommand_1 = require("./aichat/data/ContinuationCommand");
Object.defineProperty(exports, "isContinuationRequest", { enumerable: true, get: function () { return ContinuationCommand_1.isContinuationRequest; } });
Object.defineProperty(exports, "isContinuationCommand", { enumerable: true, get: function () { return ContinuationCommand_1.isContinuationCommand; } });
Object.defineProperty(exports, "isContinuationCommandRequest", { enumerable: true, get: function () { return ContinuationCommand_1.isContinuationCommandRequest; } });
var NewMessage_1 = require("./aichat/data/NewMessage");
Object.defineProperty(exports, "isStructuredMessage", { enumerable: true, get: function () { return NewMessage_1.isStructuredMessage; } });
var ChatCleaner_1 = require("./aichat/workers/ChatCleaner");
Object.defineProperty(exports, "CommonChatCleaner", { enumerable: true, get: function () { return ChatCleaner_1.CommonChatCleaner; } });
Object.defineProperty(exports, "CommonChatCleanupRegistrar", { enumerable: true, get: function () { return ChatCleaner_1.CommonChatCleanupRegistrar; } });
var handOver_1 = require("./aichat/chat/handOver");
Object.defineProperty(exports, "HandOverDelegate", { enumerable: true, get: function () { return handOver_1.HandOverDelegate; } });
var handOverMiddleware_1 = require("./aichat/middleware/handOverMiddleware");
Object.defineProperty(exports, "handOverMiddleware", { enumerable: true, get: function () { return handOverMiddleware_1.handOverMiddleware; } });
var HandOverAction_1 = require("./aichat/data/HandOverAction");
Object.defineProperty(exports, "isHandOverAction", { enumerable: true, get: function () { return HandOverAction_1.isHandOverAction; } });
Object.defineProperty(exports, "isHandBackAction", { enumerable: true, get: function () { return HandOverAction_1.isHandBackAction; } });
var HandOver_1 = require("./aichat/workers/HandOver");
Object.defineProperty(exports, "HandOverWorker", { enumerable: true, get: function () { return HandOver_1.HandOverWorker; } });
Object.defineProperty(exports, "HandBackWorker", { enumerable: true, get: function () { return HandOver_1.HandBackWorker; } });
/**
 * Tools continuation dispatcher factory
 * @param db Firestore
 * @param dispatchers Tool dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param formatContinuationError Formats continuation error
 * @param logData If true, logs data when dispatching
 * @return Continuation tools factory
 */
function toolContinuationDispatcherFactory(db, 
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
dispatchers, taskScheduler, formatContinuationError = ToolsContinuationDispatchRunner_1.commonFormatContinuationError, logData = false) {
    return new ToolContinuationDispatcherFactory_1.ToolContinuationDispatcherFactoryImpl(db, dispatchers, taskScheduler, formatContinuationError, logData);
}
/**
 * Tools continuation scheduler factory
 * @param db Firestore
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param logData If true, logs data when dispatching
 * @return Continuation scheduler factory
 */
function toolContinuationSchedulerFactory(db, taskScheduler, logData = false) {
    return new ToolsContinuationScheduler_1.ToolsContinuationSchedulerFactoryImpl(db, taskScheduler, logData);
}
//# sourceMappingURL=index.js.map