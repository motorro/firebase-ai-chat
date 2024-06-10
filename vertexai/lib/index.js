"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = exports.ResolvedContinuation = exports.SuspendedContinuation = exports.Continuation = exports.FirebaseQueueTaskScheduler = exports.isBoundChatCommand = exports.isChatCommand = exports.isReducerSuccess = exports.isFunctionSuccess = exports.getReducerSuccess = exports.getFunctionSuccess = exports.isDispatchError = exports.getDispatchError = exports.isDispatchResult = exports.printAiExample = exports.Collections = exports.tagLogger = exports.setLogger = exports.AssistantChat = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAICommandScheduler_1 = require("./aichat/VertexAICommandScheduler");
const VertexAiWrapper_1 = require("./aichat/VertexAiWrapper");
const VertexAiChatWorker_1 = require("./aichat/VertexAiChatWorker");
var firebase_ai_chat_core_2 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return firebase_ai_chat_core_2.AssistantChat; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.setLogger; } });
Object.defineProperty(exports, "tagLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.tagLogger; } });
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return firebase_ai_chat_core_2.Collections; } });
Object.defineProperty(exports, "printAiExample", { enumerable: true, get: function () { return firebase_ai_chat_core_2.printAiExample; } });
var firebase_ai_chat_core_3 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "isDispatchResult", { enumerable: true, get: function () { return firebase_ai_chat_core_3.isDispatchResult; } });
Object.defineProperty(exports, "getDispatchError", { enumerable: true, get: function () { return firebase_ai_chat_core_3.getDispatchError; } });
Object.defineProperty(exports, "isDispatchError", { enumerable: true, get: function () { return firebase_ai_chat_core_3.isDispatchError; } });
Object.defineProperty(exports, "getFunctionSuccess", { enumerable: true, get: function () { return firebase_ai_chat_core_3.getFunctionSuccess; } });
Object.defineProperty(exports, "getReducerSuccess", { enumerable: true, get: function () { return firebase_ai_chat_core_3.getReducerSuccess; } });
Object.defineProperty(exports, "isFunctionSuccess", { enumerable: true, get: function () { return firebase_ai_chat_core_3.isFunctionSuccess; } });
Object.defineProperty(exports, "isReducerSuccess", { enumerable: true, get: function () { return firebase_ai_chat_core_3.isReducerSuccess; } });
var firebase_ai_chat_core_4 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "isChatCommand", { enumerable: true, get: function () { return firebase_ai_chat_core_4.isChatCommand; } });
Object.defineProperty(exports, "isBoundChatCommand", { enumerable: true, get: function () { return firebase_ai_chat_core_4.isBoundChatCommand; } });
var firebase_ai_chat_core_5 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "FirebaseQueueTaskScheduler", { enumerable: true, get: function () { return firebase_ai_chat_core_5.FirebaseQueueTaskScheduler; } });
var firebase_ai_chat_core_6 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "Continuation", { enumerable: true, get: function () { return firebase_ai_chat_core_6.Continuation; } });
Object.defineProperty(exports, "SuspendedContinuation", { enumerable: true, get: function () { return firebase_ai_chat_core_6.SuspendedContinuation; } });
Object.defineProperty(exports, "ResolvedContinuation", { enumerable: true, get: function () { return firebase_ai_chat_core_6.ResolvedContinuation; } });
var firebase_ai_chat_core_7 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "isContinuationRequest", { enumerable: true, get: function () { return firebase_ai_chat_core_7.isContinuationRequest; } });
Object.defineProperty(exports, "isContinuationCommand", { enumerable: true, get: function () { return firebase_ai_chat_core_7.isContinuationCommand; } });
Object.defineProperty(exports, "isContinuationCommandRequest", { enumerable: true, get: function () { return firebase_ai_chat_core_7.isContinuationCommandRequest; } });
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @param debugAi If true, raw AI input and output will be logged
 * @return Chat tools interface
 */
function factory(firestore, functions, location, 
// eslint-disable-next-line  @typescript-eslint/no-explicit-any
taskScheduler, debugAi = false) {
    const _taskScheduler = taskScheduler || new firebase_ai_chat_core_1.FirebaseQueueTaskScheduler(functions, location);
    const _continuationSchedulerFactory = (0, firebase_ai_chat_core_1.toolContinuationSchedulerFactory)(firestore, _taskScheduler);
    function defaultSchedulers(queueName, taskScheduler) {
        return [new VertexAICommandScheduler_1.VertexAICommandScheduler(queueName, taskScheduler)];
    }
    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function (queueName) {
            return new firebase_ai_chat_core_1.AssistantChat(firestore, new VertexAICommandScheduler_1.VertexAICommandScheduler(queueName, _taskScheduler));
        },
        worker: function (model, threadsPath, 
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        instructions) {
            return new VertexAiChatWorker_1.VertexAiChatWorker(firestore, _taskScheduler, new VertexAiWrapper_1.VertexAiWrapper(model, firestore, threadsPath, debugAi), instructions);
        },
        continuationScheduler(queueName) {
            return _continuationSchedulerFactory.create(queueName);
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map