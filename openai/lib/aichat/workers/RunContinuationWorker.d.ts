import { ChatCommand, ChatData, ChatState, DispatchControl, TaskScheduler, ToolContinuationFactory } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatActions } from "../data/OpenAiChatAction";
import { AiWrapper } from "../AiWrapper";
import { OpenAiQueueWorker } from "./OpenAiQueueWorker";
import { OpenAiContinuationCommand } from "../data/OpenAiChatCommand";
export declare class RunContinuationWorker extends OpenAiQueueWorker {
    static isSupportedCommand(command: ChatCommand<unknown>): boolean;
    private readonly toolsDispatchFactory;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationFactory);
    doDispatch(command: OpenAiContinuationCommand, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>): Promise<void>;
}
