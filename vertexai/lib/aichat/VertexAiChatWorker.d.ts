import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCleaner, ChatCleanupRegistrar, ChatCommand, ChatWorker, CommandScheduler, DispatchError, MessageMiddleware, Meta, TaskScheduler, ToolCallRequest, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "./AiWrapper";
import { VertexAiSystemInstructions } from "./data/VertexAiSystemInstructions";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class VertexAiChatWorker implements ChatWorker {
    private readonly firestore;
    private readonly scheduler;
    private readonly wrapper;
    private readonly instructions;
    private readonly getContinuationFactory;
    private readonly chatCleanerFactory;
    private readonly chatCleanupRegistrar;
    private readonly logData;
    private readonly messageMiddleware;
    private readonly commandSchedulers;
    private getWorker;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>, formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError, chatCleanupRegistrar: ChatCleanupRegistrar, chatCleanerFactory: (queueName: string) => ChatCleaner, logData: boolean, messageMiddleware: ReadonlyArray<MessageMiddleware<any, any>>, commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>, getContinuationFactory?: () => ToolContinuationDispatcherFactory);
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
