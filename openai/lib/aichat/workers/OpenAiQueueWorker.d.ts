import { BaseChatWorker, ChatCleaner, ChatCommand, ChatData, ChatState, DispatchControl, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatActions } from "../data/OpenAiChatAction";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { AiWrapper } from "../AiWrapper";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { OpenAiChatCommand } from "../data/OpenAiChatCommand";
export type OpenAiDispatchControl = DispatchControl<ChatData>;
export declare abstract class OpenAiQueueWorker extends BaseChatWorker<OpenAiChatActions, OpenAiAssistantConfig, ChatData> {
    protected readonly wrapper: AiWrapper;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     *
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, cleaner: ChatCleaner, logData: boolean);
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatActions>>;
    protected continueNextInQueue(control: OpenAiDispatchControl, currentCommand: OpenAiChatCommand): Promise<void>;
    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param command Next command
     * @protected
     */
    protected continueQueue(control: OpenAiDispatchControl, command: OpenAiChatCommand): Promise<void>;
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
    protected updateConfig(control: OpenAiDispatchControl, state: ChatState<OpenAiAssistantConfig, ChatData>, update: (soFar: OpenAiAssistantConfig) => Partial<OpenAiAssistantConfig>): Promise<OpenAiAssistantConfig>;
}
