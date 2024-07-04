import { VertexAiQueueWorker } from "./VertexAiQueueWorker";
import { ChatCleaner, ChatData, ChatState, CommandScheduler, DispatchControl, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "../AiWrapper";
import { VertexAiChatAction } from "../data/VertexAiChatAction";
import { VertexAiChatCommand } from "../data/VertexAiChatCommand";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
export declare class HandOverWorker extends VertexAiQueueWorker {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    static isSupportedAction(action: unknown): action is VertexAiChatAction;
    doDispatch(command: VertexAiChatCommand, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
export declare class HandBackWorker extends VertexAiQueueWorker {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    static isSupportedAction(action: unknown): action is VertexAiChatAction;
    doDispatch(command: VertexAiChatCommand, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<ChatData>): Promise<void>;
}
