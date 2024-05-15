import { BaseChatWorker, ChatCommand, ChatData, ChatState, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { OpenAiChatAction, OpenAiChatActions } from "../data/OpenAiChatAction";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiDispatchControl } from "../OpenAiChatWorker";
import { AiWrapper } from "../AiWrapper";
import { ActionWorker } from "./ActionWorker";
export declare abstract class BaseOpenAiWorker extends BaseChatWorker<OpenAiChatActions, OpenAiAssistantConfig, ChatData> implements ActionWorker {
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
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatActions>>;
    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    abstract isSupportedAction(action: unknown): action is OpenAiChatAction;
    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param actions Action queue
     * @protected
     */
    protected continueQueue(control: OpenAiDispatchControl, actions: OpenAiChatActions): Promise<void>;
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
    protected updateConfig(control: OpenAiDispatchControl, state: ChatState<OpenAiAssistantConfig, ChatData>, update: (soFar: OpenAiAssistantConfig) => Partial<OpenAiAssistantConfig>): Promise<void>;
}
