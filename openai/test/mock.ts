import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {ChatData, ChatMessage, ChatState} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../src/aichat/data/OpenAiAssistantConfig";

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
export const assistantId = "assistant123";
export const dispatcherId = "dispatcher123";
export const threadId = "thread123";

export const userMessage: ChatMessage = {
    userId: userId,
    dispatchId: runId,
    author: "user",
    text: "A message from user",
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23))
};

export const aiMessage: ChatMessage = {
    userId: userId,
    dispatchId: runId,
    author: "ai",
    text: "A message from AI",
    inBatchSortIndex: 1,
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 24))
};

export const data: Data = {
    value: "test"
};

export const chatState: ChatState<OpenAiAssistantConfig, Data> = {
    userId: userId,
    config: {
        assistantConfig: {
            assistantId
        },
        dispatcherId: dispatcherId
    },
    data: data,
    status: "userInput",
    latestDispatchId: "dispatch",
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    updatedAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23))
};

