import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatWorker, Meta, TaskScheduler, ToolContinuationFactory } from "@motorro/firebase-ai-chat-core";
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
    private getWorker;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>, getContinuationFactory?: () => ToolContinuationFactory);
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
