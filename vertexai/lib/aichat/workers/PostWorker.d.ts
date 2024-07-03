import { ChatCleaner, ChatCommand, ChatData, ChatState, Continuation, DispatchControl, ToolContinuationSoFar, MessageMiddleware, TaskScheduler, ToolCallRequest, ToolCallsResult, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { PostExplicit } from "../data/VertexAiChatAction";
import { VertexAiQueueWorker } from "./VertexAiQueueWorker";
import { VertexAiSystemInstructions } from "../data/VertexAiSystemInstructions";
import { AiWrapper, PostMessageResult } from "../AiWrapper";
import { VertexAiChatCommand, VertexAiContinuationCommand } from "../data/VertexAiChatCommand";
declare abstract class BasePostWorker extends VertexAiQueueWorker {
    private readonly instructions;
    protected readonly getDispatcherFactory: () => ToolContinuationDispatcherFactory;
    private readonly messageMiddleware;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     * @param cleaner Chat cleaner
     * @param logData Logs chat data if true
     * @param messageMiddleware Optional Message processing middleware
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>, getDispatcherFactory: () => ToolContinuationDispatcherFactory, cleaner: ChatCleaner, logData: boolean, messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>);
    /**
     * Runs post action
     * @param command Command being processed
     * @param threadId Thread ID
     * @param dispatcherId Dispatcher ID
     * @param instructions AI instructions
     * @param soFar Data so far
     * @param updateStateData Updates state data
     * @returns Continuation for post message result
     * @protected
     */
    protected abstract doPost(command: VertexAiChatCommand, threadId: string, dispatcherId: string, instructions: VertexAiSystemInstructions<ChatData>, soFar: ChatData, updateStateData: (data: ChatData) => Promise<ChatData>): Promise<Continuation<PostMessageResult<ChatData>>>;
    /**
     * Creates a post dispatch function
     * @param command Command being processed
     * @param dispatcherId Dispatcher ID
     * @param updateData Updates chat data
     * @returns Tools dispatching function
     * @protected
     */
    protected getPostDispatch(command: VertexAiChatCommand, dispatcherId: string, updateData: (data: ChatData) => Promise<ChatData>): (data: ToolContinuationSoFar<ChatData>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<ChatData>>>;
    doDispatch(command: VertexAiChatCommand, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
export declare class PostWorker extends BasePostWorker {
    static isSupportedAction(action: unknown): action is "post";
    protected doPost(command: VertexAiChatCommand, threadId: string, dispatcherId: string, instructions: VertexAiSystemInstructions<ChatData>, soFar: ChatData, updateStateData: (data: ChatData) => Promise<ChatData>): Promise<Continuation<PostMessageResult<ChatData>>>;
}
export declare class ExplicitPostWorker extends BasePostWorker {
    static isSupportedAction(action: unknown): action is PostExplicit;
    protected doPost(command: VertexAiChatCommand, threadId: string, dispatcherId: string, instructions: VertexAiSystemInstructions<ChatData>, soFar: ChatData, updateStateData: (data: ChatData) => Promise<ChatData>): Promise<Continuation<PostMessageResult<ChatData>>>;
}
export declare class ContinuePostWorker extends BasePostWorker {
    static isSupportedCommand(command: ChatCommand<unknown>): command is VertexAiContinuationCommand;
    protected doPost(command: VertexAiContinuationCommand, threadId: string, dispatcherId: string, instructions: VertexAiSystemInstructions<ChatData>, soFar: ChatData, updateStateData: (data: ChatData) => Promise<ChatData>): Promise<Continuation<PostMessageResult<ChatData>>>;
}
export {};
