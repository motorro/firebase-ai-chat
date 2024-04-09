import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {AssistantConfig, ChatData, ChatState} from "../src";

export const NAME = "Chat";
export const CHATS = "chats";

export interface Data extends ChatData {
    readonly value: string
}
export interface AiConfig extends AssistantConfig {
    readonly assistantId: string
}

export interface Data2 extends ChatData {
    readonly value: string
}

export type DispatchAction = "create" | "close";

export const runId = "run-1";
export const userId = "123456";
export const assistantId = "assistant123";
export const dispatcherId = "dispatcher123";
export const threadId = "thread123";

export const config: AiConfig = {
    assistantId: assistantId
};

export const data: Data = {
    value: "test"
};

export const chatState: ChatState<AiConfig, Data> = {
    userId: userId,
    config: {
        assistantConfig: config,
        dispatcherId: dispatcherId
    },
    data: data,
    status: "userInput",
    latestDispatchId: "dispatch",
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    updatedAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23))
};


