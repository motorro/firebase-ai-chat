import { ChatCleaner, ChatData, ChatState, DispatchControl, MessageMiddleware, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
import { AiWrapper } from "../AiWrapper";
export declare class RetrieveWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    private readonly messageMiddleware;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     * @param messageMiddleware Message processing middleware
     *
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>);
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
