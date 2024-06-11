import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatWorker, DispatchError, Meta, TaskScheduler, ToolCallRequest, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
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
    private readonly logData;
    private getWorker;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>, formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError, logData: boolean, getContinuationFactory?: () => ToolContinuationDispatcherFactory);
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
