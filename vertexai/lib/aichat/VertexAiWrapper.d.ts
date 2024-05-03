import { ChatData } from "@motorro/firebase-ai-chat-core";
import { GenerativeModel } from "@google-cloud/vertexai";
import { VertexAiSystemInstructions } from "./data/VertexAiSystemInstructions";
import { firestore } from "firebase-admin";
import { AiWrapper, PostMessageResult } from "./AiWrapper";
import { ThreadMessage } from "./data/ThreadMessage";
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
    postMessage<DATA extends ChatData>(threadId: string, instructions: VertexAiSystemInstructions<DATA>, messages: ReadonlyArray<string>, dataSoFar: DATA): Promise<PostMessageResult<DATA>>;
    private doPostMessage;
    deleteThread(threadId: string): Promise<void>;
}
