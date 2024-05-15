import { ChatData, Continuation, Messages, ToolsContinuationDispatcher } from "@motorro/firebase-ai-chat-core";
import OpenAI from "openai";
import { AiWrapper } from "./AiWrapper";
import { RunContinuationMeta, RunContinuationRequest } from "./data/RunResponse";
/**
 * Wraps Open AI assistant use
 */
export declare class OpenAiWrapper implements AiWrapper {
    private readonly openAi;
    constructor(openAi: OpenAI);
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    postMessage(threadId: string, message: string): Promise<string>;
    run<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>): Promise<Continuation<DATA>>;
    private doRun;
    processToolsResponse<DATA extends ChatData>(threadId: string, assistantId: string, dataSoFar: DATA, dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>, request: RunContinuationRequest<DATA>): Promise<Continuation<DATA>>;
    getMessages(threadId: string, from: string | undefined): Promise<Messages>;
    deleteThread(threadId: string): Promise<void>;
    /**
     * Runs AI
     * @param block Function to run
     * @private
     */
    private runAi;
}
