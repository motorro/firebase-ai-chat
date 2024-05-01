"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.OpenAiWrapper = exports.AssistantChat = exports.OpenAiChatWorker = exports.Collections = exports.setLogger = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return firebase_ai_chat_core_1.AssistantChat; } });
const OpenAiChatWorker_1 = require("./aichat/OpenAiChatWorker");
Object.defineProperty(exports, "OpenAiChatWorker", { enumerable: true, get: function () { return OpenAiChatWorker_1.OpenAiChatWorker; } });
const OpenAICommandScheduler_1 = require("./aichat/OpenAICommandScheduler");
var firebase_ai_chat_core_2 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.setLogger; } });
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return firebase_ai_chat_core_2.Collections; } });
var OpenAiWrapper_1 = require("./aichat/OpenAiWrapper");
Object.defineProperty(exports, "OpenAiWrapper", { enumerable: true, get: function () { return OpenAiWrapper_1.OpenAiWrapper; } });
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @return Chat tools interface
 */
function factory(firestore, functions, location) {
    const scheduler = new firebase_ai_chat_core_1.FirebaseQueueTaskScheduler(functions, location);
    return {
        chat: function (queueName) {
            return new firebase_ai_chat_core_1.AssistantChat(firestore, new OpenAICommandScheduler_1.OpenAICommandScheduler(queueName, scheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function (aiWrapper, dispatchers) {
            return new OpenAiChatWorker_1.OpenAiChatWorker(firestore, scheduler, aiWrapper, dispatchers);
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map