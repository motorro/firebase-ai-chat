"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.OpenAiChatWorker = exports.isContinuationCommandRequest = exports.isContinuationCommand = exports.isContinuationRequest = exports.ResolvedContinuation = exports.SuspendedContinuation = exports.Continuation = exports.FirebaseQueueTaskScheduler = exports.isBoundChatCommand = exports.isChatCommand = exports.isReducerSuccess = exports.isFunctionSuccess = exports.getReducerSuccess = exports.getFunctionSuccess = exports.isDispatchError = exports.getDispatchError = exports.isDispatchResult = exports.printAiExample = exports.Collections = exports.setLogger = exports.AssistantChat = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiChatWorker_1 = require("./aichat/OpenAiChatWorker");
Object.defineProperty(exports, "OpenAiChatWorker", { enumerable: true, get: function () { return OpenAiChatWorker_1.OpenAiChatWorker; } });
const OpenAICommandScheduler_1 = require("./aichat/OpenAICommandScheduler");
const OpenAiWrapper_1 = require("./aichat/OpenAiWrapper");
var firebase_ai_chat_core_2 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return firebase_ai_chat_core_2.AssistantChat; } });
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.setLogger; } });
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
 * @return Chat tools interface
 */
function factory(firestore, functions, location, taskScheduler) {
    const _taskScheduler = taskScheduler || new firebase_ai_chat_core_1.FirebaseQueueTaskScheduler(functions, location);
    function defaultSchedulers(queueName, taskScheduler) {
        return [new OpenAICommandScheduler_1.OpenAICommandScheduler(queueName, taskScheduler)];
    }
    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function (queueName, commandSchedulers = defaultSchedulers) {
            return new firebase_ai_chat_core_1.AssistantChat(firestore, commandSchedulers(queueName, _taskScheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker(openAi, dispatchers) {
            return new OpenAiChatWorker_1.OpenAiChatWorker(firestore, _taskScheduler, new OpenAiWrapper_1.OpenAiWrapper(openAi), (0, firebase_ai_chat_core_1.toolContinuationFactory)(firestore, dispatchers, _taskScheduler));
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map