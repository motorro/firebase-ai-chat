import { ToolsDispatcher } from "./ToolsDispatcher";
import { ChatData } from "./data/ChatState";
export interface Messages {
    readonly messages: ReadonlyArray<string>;
    readonly latestMessageId?: string;
}
export interface AiWrapper {
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    postMessages(threadId: string, messages: ReadonlyArray<string>): Promise<string | undefined>;
    run<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsDispatcher<DATA>): Promise<DATA>;
    getMessages(threadId: string, from: string | undefined): Promise<Messages>;
    deleteThread(threadId: string): Promise<void>;
}
