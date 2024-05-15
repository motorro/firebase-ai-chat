"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.AssistantChat = exports.OpenAiChatWorker = exports.Collections = exports.setLogger = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return firebase_ai_chat_core_1.AssistantChat; } });
const OpenAiChatWorker_1 = require("./aichat/OpenAiChatWorker");
Object.defineProperty(exports, "OpenAiChatWorker", { enumerable: true, get: function () { return OpenAiChatWorker_1.OpenAiChatWorker; } });
const OpenAICommandScheduler_1 = require("./aichat/OpenAICommandScheduler");
const OpenAiWrapper_1 = require("./aichat/OpenAiWrapper");
var firebase_ai_chat_core_2 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.setLogger; } });
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return firebase_ai_chat_core_2.Collections; } });
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param dispatchers Tools dispatchers
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Chat tools interface
 */
function factory(firestore, functions, location, dispatchers, taskScheduler) {
    const _taskScheduler = taskScheduler || new firebase_ai_chat_core_1.FirebaseQueueTaskScheduler(functions, location);
    const _toolsContinuationFactory = (0, firebase_ai_chat_core_1.toolContinuationFactory)(firestore, dispatchers);
    function defaultSchedulers(queueName, taskScheduler) {
        return [new OpenAICommandScheduler_1.OpenAICommandScheduler(queueName, taskScheduler)];
    }
    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function (queueName, commandSchedulers = defaultSchedulers) {
            return new firebase_ai_chat_core_1.AssistantChat(firestore, commandSchedulers(queueName, _taskScheduler));
        },
        ai(openAi) {
            return new OpenAiWrapper_1.OpenAiWrapper(openAi);
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function (aiWrapper) {
            return new OpenAiChatWorker_1.OpenAiChatWorker(firestore, _taskScheduler, aiWrapper, _toolsContinuationFactory);
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map