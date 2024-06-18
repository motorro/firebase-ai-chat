import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {ChatData, ChatMessage, ChatState} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../src";
import {Tool} from "@google-cloud/vertexai/src/types/content";

export const NAME = "Chat";
export const CHATS = "chats";

export interface Data extends ChatData {
    readonly value: string
}

export interface Data2 extends ChatData {
    readonly value: string
}

export const runId = "run-1";
export const userId = "123456";
export const threadId = "thread123";
export const instructionsId = "instructions1";

export const userMessage: ChatMessage = {
    userId: userId,
    dispatchId: runId,
    author: "user",
    text: "A message from user",
    data: null,
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    meta: null
};

export const aiMessage: ChatMessage = {
    userId: userId,
    dispatchId: runId,
    author: "ai",
    text: "A message from AI",
    data: null,
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 24)),
    meta: null
};

export const data: Data = {
    value: "test"
};

export const data2: Data = {
    value: "test2"
};

export const chatState: ChatState<VertexAiAssistantConfig, Data> = {
    userId: userId,
    config: {
        assistantConfig: {
            engine: "vertexai",
            instructionsId: instructionsId
        }
    },
    data: data,
    status: "userInput",
    latestDispatchId: "dispatch",
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    updatedAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    meta: null
};

export const instructions1 = "You are number 1 assistant";
export const instructions2 = "You are number 2 assistant";
export const toolsDefinition: Array<Tool> = [
    {functionDeclarations: [{name: "someFunction"}]}
];


