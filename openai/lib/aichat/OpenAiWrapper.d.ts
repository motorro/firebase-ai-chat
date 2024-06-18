import { ChatData, Continuation, NewMessage, ToolCallRequest, ToolCallsResult } from "@motorro/firebase-ai-chat-core";
import OpenAI from "openai";
import { AiWrapper } from "./AiWrapper";
import { RunContinuationRequest } from "./data/RunResponse";
import { OpenAiMessageMapper } from "./OpenAiMessageMapper";
import { AiMessages } from "./data/AiMessages";
/**
 * Wraps Open AI assistant use
 */
export declare class OpenAiWrapper implements AiWrapper {
    private readonly openAi;
    private readonly debugAi;
    private readonly messageMapper;
    constructor(openAi: OpenAI, debugAi?: boolean, messageMapper?: OpenAiMessageMapper);
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    postMessage(threadId: string, message: NewMessage): Promise<string>;
    run<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, runId: string) => Promise<Continuation<ToolCallsResult<DATA>>>): Promise<Continuation<DATA>>;
    private doRun;
    processToolsResponse<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, runId: string) => Promise<Continuation<ToolCallsResult<DATA>>>, request: RunContinuationRequest<DATA>): Promise<Continuation<DATA>>;
    getMessages(threadId: string, from: string | undefined): Promise<AiMessages>;
    deleteThread(threadId: string): Promise<void>;
    /**
     * Runs AI
     * @param block Function to run
     * @private
     */
    private runAi;
}
