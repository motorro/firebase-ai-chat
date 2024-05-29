import { ChatData, Continuation, ToolCallRequest, ToolCallsResult } from "@motorro/firebase-ai-chat-core";
import { GenerativeModel } from "@google-cloud/vertexai";
import { VertexAiSystemInstructions } from "./data/VertexAiSystemInstructions";
import { firestore } from "firebase-admin";
import { AiWrapper, PostMessageResult } from "./AiWrapper";
import { ThreadMessage } from "./data/ThreadMessage";
import { RunContinuationRequest } from "./data/RunResponse";
import CollectionReference = firestore.CollectionReference;
/**
 * Wraps Open AI assistant use
 */
export declare class VertexAiWrapper implements AiWrapper {
    private readonly model;
    private readonly firestore;
    private readonly threads;
    /**
     * Constructor
     * @param model Pre-configured `GenerativeModel`
     * @param firestore Firebase firestore
     * @param threadsPath Threads collection path
     */
    constructor(model: GenerativeModel, firestore: FirebaseFirestore.Firestore, threadsPath: string);
    /**
     * Generates system instructions
     * @param config System instructions config
     * @return System instructions content
     */
    private static generateSystemInstructions;
    private static isFunctionCall;
    /**
     * Sometimes Gemini creates a call with faulty data:
     * '{"functionCall":{"args":{"value":25}}}'
     * @param part Part to check
     * @return True if part is a function call
     * @private
     */
    private static checkFunctionCall;
    /**
     * Thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @return Message collection reference
     * @private
     */
    getThreadMessageCollection(threadId: string): CollectionReference<ThreadMessage>;
    /**
     * Returns thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @private
     */
    getThreadMessages(threadId: string): Promise<ReadonlyArray<[string, ThreadMessage]>>;
    createThread(meta: Readonly<Record<string, string>>): Promise<string>;
    postMessage<DATA extends ChatData>(threadId: string, instructions: VertexAiSystemInstructions<DATA>, messages: ReadonlyArray<string>, dataSoFar: DATA, dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>): Promise<Continuation<PostMessageResult<DATA>>>;
    /**
     * Maintains conversation data
     * @param threadId Thread ID
     * @param instructions Instructions
     * @param parts Parts to post
     * @param dataSoFar Data so far
     * @param dispatch Dispatch function
     * @return Post result
     * @private
     */
    private doPost;
    processToolsResponse<DATA extends ChatData>(threadId: string, instructions: VertexAiSystemInstructions<DATA>, request: RunContinuationRequest<DATA>, dataSoFar: DATA, dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>): Promise<Continuation<PostMessageResult<DATA>>>;
    /**
     * Runs AI
     * @param chat Chat session
     * @param parts Parts to provide
     * @param soFar Data so far
     * @param dispatch Dispatching function
     * @return Inter-run session state
     * @private
     */
    private run;
    deleteThread(threadId: string): Promise<void>;
}
