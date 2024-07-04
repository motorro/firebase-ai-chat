import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {AssistantConfig, ChatCommandData, ChatData, ChatState, HandBackAction, HandOverAction} from "../src";
import {ToolCallData, ToolsContinuationData} from "../src/aichat/data/ContinuationCommand";

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

export type DispatchAction = "create" | "process" | "close" | HandOverAction | HandBackAction;

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
export const data2: Data = {
    value: "test2"
};
export const data3: Data = {
    value: "data3"
};

export const chatState: ChatState<AiConfig, Data> = {
    userId: userId,
    config: {
        assistantConfig: config
    },
    data: data,
    status: "userInput",
    latestDispatchId: "dispatchId",
    createdAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    updatedAt: Timestamp.fromDate(new Date(2024, 1, 13, 20, 23)),
    meta: {
        userMessageMeta: {
            name: "Vasya"
        }
    }
};

export const toolCall1: ToolCallData<Data> = {
    index: 1,
    call: {
        request: {
            toolCallId: "call1",
            toolName: "callOne",
            args: {a: 1}
        },
        response: null
    }
};

export const toolCall2: ToolCallData<Data> = {
    index: 2,
    call: {
        request: {
            toolCallId: "call2",
            toolName: "callTwo",
            args: {a: 2}
        },
        response: null
    }
};

export const commandData: ChatCommandData = {
    ownerId: userId,
    chatDocumentPath: "chatDoc",
    dispatchId: "dispatchId",
    meta: null
};

export const continuationData: ToolsContinuationData = {
    dispatcherId: dispatcherId,
    state: "suspended",
    handOver: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
};


