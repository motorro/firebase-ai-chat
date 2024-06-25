import { ChatState, ChatData, DispatchControl, TaskScheduler, ToolContinuationDispatcherFactory, ChatCleaner } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatAction, OpenAiChatActions } from "../data/OpenAiChatAction";
import { AiWrapper } from "../AiWrapper";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
export declare class RunWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    private readonly toolsDispatchFactory;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, chatCleaner: ChatCleaner, toolsDispatchFactory: ToolContinuationDispatcherFactory, logData: boolean);
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<OpenAiChatActions, ChatData>): Promise<void>;
}
