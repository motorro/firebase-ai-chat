"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsDefinition = exports.instructions2 = exports.instructions1 = exports.chatState = exports.data2 = exports.data = exports.aiMessage = exports.userMessage = exports.instructionsId = exports.threadId = exports.userId = exports.runId = exports.CHATS = exports.NAME = void 0;
const firebase_admin_1 = require("firebase-admin");
var Timestamp = firebase_admin_1.firestore.Timestamp;
exports.NAME = "Chat";
exports.CHATS = "chats";
exports.runId = "run-1";
exports.userId = "123456";
exports.threadId = "thread123";
exports.instructionsId = "instructions1";
exports.userMessage = {
    userId: exports.userId,
    dispatchId: exports.runId,
    author: "user",
    text: "A message from user",
    data: null,
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    meta: null
};
exports.aiMessage = {
    userId: exports.userId,
    dispatchId: exports.runId,
    author: "ai",
    text: "A message from AI",
    data: null,
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 24)),
    meta: null
};
exports.data = {
    value: "test"
};
exports.data2 = {
    value: "test2"
};
exports.chatState = {
    userId: exports.userId,
    config: {
        assistantConfig: {
            engine: "vertexai",
            instructionsId: exports.instructionsId
        }
    },
    data: exports.data,
    status: "userInput",
    latestDispatchId: "dispatch",
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    updatedAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    meta: null
};
exports.instructions1 = "You are number 1 assistant";
exports.instructions2 = "You are number 2 assistant";
exports.toolsDefinition = [
    { functionDeclarations: [{ name: "someFunction" }] }
];
//# sourceMappingURL=mock.js.map