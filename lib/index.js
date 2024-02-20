"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.factory = exports.Collections = exports.AssistantChat = exports.ChatWorker = exports.OpenAiWrapper = exports.setLogger = void 0;
const AssistantChat_1 = require("./aichat/AssistantChat");
Object.defineProperty(exports, "AssistantChat", { enumerable: true, get: function () { return AssistantChat_1.AssistantChat; } });
const ChatWorker_1 = require("./aichat/ChatWorker");
Object.defineProperty(exports, "ChatWorker", { enumerable: true, get: function () { return ChatWorker_1.ChatWorker; } });
const FirebaseQueueTaskScheduler_1 = require("./aichat/FirebaseQueueTaskScheduler");
var logging_1 = require("./logging");
Object.defineProperty(exports, "setLogger", { enumerable: true, get: function () { return logging_1.setLogger; } });
var OpenAiWrapper_1 = require("./aichat/OpenAiWrapper");
Object.defineProperty(exports, "OpenAiWrapper", { enumerable: true, get: function () { return OpenAiWrapper_1.OpenAiWrapper; } });
var Collections_1 = require("./aichat/data/Collections");
Object.defineProperty(exports, "Collections", { enumerable: true, get: function () { return Collections_1.Collections; } });
/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @return Chat tools interface
 */
function factory(firestore, functions) {
    return {
        chat: function (name, location, scheduling = {}) {
            const scheduler = new FirebaseQueueTaskScheduler_1.FirebaseQueueTaskScheduler(functions, location);
            return new AssistantChat_1.AssistantChat(firestore, name, scheduler, scheduling);
        },
        worker: function (aiWrapper, dispatchers) {
            return new ChatWorker_1.ChatWorker(firestore, aiWrapper, dispatchers);
        }
    };
}
exports.factory = factory;
//# sourceMappingURL=index.js.map