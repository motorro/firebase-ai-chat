import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand, ChatData, ChatWorker, DispatchControl, Meta, TaskScheduler, ToolsDispatcher } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatActions } from "./data/OpenAiChatAction";
import { OpenAiAssistantConfig } from "./data/OpenAiAssistantConfig";
import { AiWrapper } from "./AiWrapper";
export type OpenAiDispatchControl = DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>;
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class OpenAiChatWorker implements ChatWorker {
    private workers;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>);
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
