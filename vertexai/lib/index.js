"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.AssistantChat = exports.VertexAiChatWorker = exports.Collections = exports.setLogger = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return firebase_ai_chat_core_1.AssistantChat; } });
const VertexAiChatWorker_1 = require("./aichat/VertexAiChatWorker");
Object.defineProperty(exports, "VertexAiChatWorker", { enumerable: true, get: function () { return VertexAiChatWorker_1.VertexAiChatWorker; } });
const VertexAICommandScheduler_1 = require("./aichat/VertexAICommandScheduler");
const VertexAiWrapper_1 = require("./aichat/VertexAiWrapper");
var firebase_ai_chat_core_2 = require("@motorro/firebase-ai-chat-core");
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return firebase_ai_chat_core_2.setLogger; } });
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return firebase_ai_chat_core_2.Collections; } });
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
            return new firebase_ai_chat_core_1.AssistantChat(firestore, new VertexAICommandScheduler_1.VertexAICommandScheduler(queueName, scheduler));
        },
        ai(model, threadsPath) {
            return new VertexAiWrapper_1.VertexAiWrapper(model, firestore, threadsPath);
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function (aiWrapper, instructions) {
            return new VertexAiChatWorker_1.VertexAiChatWorker(firestore, scheduler, aiWrapper, instructions);
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map