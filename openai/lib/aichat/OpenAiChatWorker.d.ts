import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatWorker, Meta, TaskScheduler, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "./AiWrapper";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class OpenAiChatWorker implements ChatWorker {
    private readonly firestore;
    private readonly scheduler;
    private readonly wrapper;
    private readonly toolsDispatchFactory;
    private readonly logData;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationDispatcherFactory, logData: boolean);
    private getWorker;
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
