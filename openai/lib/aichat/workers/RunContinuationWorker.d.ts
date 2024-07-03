import { ChatCleaner, ChatCommand, ChatData, ChatState, DispatchControl, TaskScheduler, ToolContinuationDispatcherFactory } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { AiWrapper } from "../AiWrapper";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiContinuationCommand } from "../data/OpenAiChatCommand";
export declare class RunContinuationWorker extends OpenAiQueueWorker {
    static isSupportedCommand(command: ChatCommand<unknown>): boolean;
    private readonly toolsDispatchFactory;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationDispatcherFactory, cleaner: ChatCleaner, logData: boolean);
    doDispatch(command: OpenAiContinuationCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
