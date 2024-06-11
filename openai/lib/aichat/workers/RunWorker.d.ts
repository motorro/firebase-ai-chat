import { ChatState, ChatData, DispatchControl, TaskScheduler, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatAction, OpenAiChatActions } from "../data/OpenAiChatAction";
import { AiWrapper } from "../AiWrapper";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
export declare class RunWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    private readonly toolsDispatchFactory;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationDispatcherFactory, logData: boolean);
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>): Promise<void>;
}
