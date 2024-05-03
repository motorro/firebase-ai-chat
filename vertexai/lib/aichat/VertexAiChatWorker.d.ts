import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatData, ChatWorker, DispatchControl, Meta, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { VertexAiChatActions } from "./data/VertexAiChatAction";
import { VertexAiAssistantConfig } from "./data/VertexAiAssistantConfig";
import { AiWrapper } from "./AiWrapper";
import { VertexAiSystemInstructions } from "./data/VertexAiSystemInstructions";
export type OpenAiDispatchControl = DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>;
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class VertexAiChatWorker implements ChatWorker {
    private workers;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>);
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
