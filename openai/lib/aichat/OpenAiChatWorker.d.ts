import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatWorker, Meta, TaskScheduler, ToolContinuationFactory } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "./AiWrapper";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class OpenAiChatWorker implements ChatWorker {
    private firestore;
    private scheduler;
    private wrapper;
    private toolsDispatchFactory;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationFactory);
    private getWorker;
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
