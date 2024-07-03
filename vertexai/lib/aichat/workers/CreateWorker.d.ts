import { ChatCleaner, ChatCleanupRegistrar, ChatData, ChatState, DispatchControl, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { VertexAiQueueWorker } from "./VertexAiQueueWorker";
import { VertexAiChatCommand } from "../data/VertexAiChatCommand";
import { AiWrapper } from "../AiWrapper";
export declare class CreateWorker extends VertexAiQueueWorker {
    private readonly cleanupRegistrar;
    static isSupportedAction(action: unknown): action is "create";
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, cleanupRegistrar: ChatCleanupRegistrar);
    doDispatch(command: VertexAiChatCommand, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
