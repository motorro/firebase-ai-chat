import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { ChatCleaner, ChatData, ChatState, CommandScheduler, DispatchControl, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "../AiWrapper";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
export declare class HandOverWorker extends OpenAiQueueWorker {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
export declare class HandBackWorker extends OpenAiQueueWorker {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    doDispatch(command: OpenAiChatCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
