import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCleaner, ChatCleanupRegistrar, ChatCommand, ChatWorker, CommandScheduler, MessageMiddleware, Meta, TaskScheduler, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "./AiWrapper";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class OpenAiChatWorker implements ChatWorker {
    private readonly firestore;
    private readonly scheduler;
    private readonly wrapper;
    private readonly toolsDispatchFactory;
    private readonly chatCleanerFactory;
    private readonly chatCleanupRegistrar;
    private readonly logData;
    private readonly messageMiddleware;
    private readonly commandSchedulers;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationDispatcherFactory, chatCleanupRegistrar: ChatCleanupRegistrar, chatCleanerFactory: (queueName: string) => ChatCleaner, logData: boolean, messageMiddleware: ReadonlyArray<MessageMiddleware<any, any>>, commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>);
    private getWorker;
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
