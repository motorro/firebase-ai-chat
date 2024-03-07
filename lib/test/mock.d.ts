import { ChatData, ChatMessage, ChatState } from "../src";
export declare const NAME = "Chat";
export declare const CHATS = "chats";
export interface Data extends ChatData {
    readonly value: string;
}
export interface Data2 extends ChatData {
    readonly value: string;
}
export declare const runId = "run-1";
export declare const userId = "123456";
export declare const assistantId = "assistant123";
export declare const dispatcherId = "dispatcher123";
export declare const threadId = "thread123";
export declare const userMessage: ChatMessage;
export declare const aiMessage: ChatMessage;
export declare const data: Data;
export declare const chatState: ChatState<Data>;
