"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolContinuationFactory = exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = exports.ResolvedContinuation = exports.SuspendedContinuation = exports.Continuation = exports.Collections = exports.FirebaseQueueTaskScheduler = exports.isBoundChatCommand = exports.DispatchRunner = exports.BaseChatWorker = exports.AssistantChat = exports.isDispatchSuccess = exports.getDispatchSuccess = exports.isDispatchError = exports.getDispatchError = exports.isDispatchResult = exports.setLogger = exports.logger = exports.ChatError = exports.printAiExample = exports.isPermanentError = void 0;
const ToolContinuationFactory_1 = require("./aichat/workers/ToolContinuationFactory");
var AiData_1 = require("./aichat/data/AiData");
Object.defineProperty(exports, "isPermanentError", { enumerable: true, get: function () { return AiData_1.isPermanentError; } });
Object.defineProperty(exports, "printAiExample", { enumerable: true, get: function () { return AiData_1.printAiExample; } });
var ChatError_1 = require("./aichat/data/ChatError");
Object.defineProperty(exports, "ChatError", { enumerable: true, get: function () { return ChatError_1.ChatError; } });
var logging_1 = require("./logging");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logging_1.logger; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return logging_1.setLogger; } });
var ToolsDispatcher_1 = require("./aichat/ToolsDispatcher");
Object.defineProperty(exports, "isDispatchResult", { enumerable: true, get: function () { return ToolsDispatcher_1.isDispatchResult; } });
Object.defineProperty(exports, "getDispatchError", { enumerable: true, get: function () { return ToolsDispatcher_1.getDispatchError; } });
Object.defineProperty(exports, "isDispatchError", { enumerable: true, get: function () { return ToolsDispatcher_1.isDispatchError; } });
Object.defineProperty(exports, "getDispatchSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.getDispatchSuccess; } });
Object.defineProperty(exports, "isDispatchSuccess", { enumerable: true, get: function () { return ToolsDispatcher_1.isDispatchSuccess; } });
var AssistantChat_1 = require("./aichat/AssistantChat");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return AssistantChat_1.AssistantChat; } });
var BaseChatWorker_1 = require("./aichat/workers/BaseChatWorker");
Object.defineProperty(exports, "BaseChatWorker", { enumerable: true, get: function () { return BaseChatWorker_1.BaseChatWorker; } });
var DispatchRunner_1 = require("./aichat/workers/DispatchRunner");
Object.defineProperty(exports, "DispatchRunner", { enumerable: true, get: function () { return DispatchRunner_1.DispatchRunner; } });
var ChatCommand_1 = require("./aichat/data/ChatCommand");
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
/**
 * Tools continuation components factory
 * @param db Firestore
 * @param dispatchers Tool dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Continuation tools factory
 */
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function toolContinuationFactory(db, dispatchers, taskScheduler) {
    return new ToolContinuationFactory_1.ToolContinuationFactoryImpl(db, dispatchers, taskScheduler);
}
exports.toolContinuationFactory = toolContinuationFactory;
//# sourceMappingURL=index.js.map