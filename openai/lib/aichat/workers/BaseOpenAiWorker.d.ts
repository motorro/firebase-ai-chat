import { BaseChatWorker, ChatCommand, ChatData, TaskScheduler, ToolsDispatcher } from "@motorro/firebase-ai-chat-core";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { OpenAiChatActions } from "../data/OpenAiChatAction";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiDispatchControl } from "../OpenAiChatWorker";
import { AiWrapper } from "../AiWrapper";
export declare abstract class BaseOpenAiWorker extends BaseChatWorker<OpenAiChatActions, OpenAiAssistantConfig, ChatData> {
    protected readonly wrapper: AiWrapper;
    protected readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    protected readonly defaultDispatcher: ToolsDispatcher<ChatData>;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>);
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatActions>>;
    /**
     * Is supported Open AI command
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    protected abstract isSupportedAction(action: string): boolean;
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
}
