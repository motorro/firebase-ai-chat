import { BaseChatWorker, ChatCommand, ChatData, ChatState, DispatchControl, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { VertexAiChatActions } from "../data/VertexAiChatAction";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { AiWrapper } from "../AiWrapper";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { VertexAiChatCommand } from "../data/VertexAiChatCommand";
export type VertexAiDispatchControl = DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>;
export declare abstract class VertexAiQueueWorker extends BaseChatWorker<VertexAiChatActions, VertexAiAssistantConfig, ChatData> {
    protected readonly wrapper: AiWrapper;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper);
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<VertexAiChatActions>>;
    protected continueNextInQueue(control: VertexAiDispatchControl, currentCommand: VertexAiChatCommand): Promise<void>;
    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param command Next command
     * @protected
     */
    protected continueQueue(control: VertexAiDispatchControl, command: VertexAiChatCommand): Promise<void>;
    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @param control Chat control
     * @protected
     */
    private runSwitchToUser;
    /**
     * Updates config
     * @param control Chat control
     * @param state Current state
     * @param update Builds config changes
     * @protected
     */
    protected updateConfig(control: VertexAiDispatchControl, state: ChatState<VertexAiAssistantConfig, ChatData>, update: (soFar: VertexAiAssistantConfig) => Partial<VertexAiAssistantConfig>): Promise<void>;
}
