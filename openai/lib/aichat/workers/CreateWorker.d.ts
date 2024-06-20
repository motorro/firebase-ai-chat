import { ChatState, ChatData, DispatchControl, ChatCleanupRegistrar, TaskScheduler, ChatCleaner } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatAction, OpenAiChatActions } from "../data/OpenAiChatAction";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
import { AiWrapper } from "../AiWrapper";
export declare class CreateWorker extends OpenAiQueueWorker {
    private readonly cleanupRegistrar;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, cleanupRegistrar: ChatCleanupRegistrar);
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>): Promise<void>;
}
