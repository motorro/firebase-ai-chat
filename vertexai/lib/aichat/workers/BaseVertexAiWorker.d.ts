import { BaseChatWorker, ChatCommand, ChatData, ChatState, TaskScheduler, ToolsDispatcher } from "@motorro/firebase-ai-chat-core";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { VertexAiChatActions } from "../data/VertexAiChatAction";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { OpenAiDispatchControl } from "../VertexAiChatWorker";
import { AiWrapper } from "../AiWrapper";
import { VertexAiSystemInstructions } from "../data/VertexAiSystemInstructions";
export declare abstract class BaseVertexAiWorker extends BaseChatWorker<VertexAiChatActions, VertexAiAssistantConfig, ChatData> {
    protected readonly wrapper: AiWrapper;
    protected readonly instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>;
    protected readonly defaultDispatcher: ToolsDispatcher<ChatData>;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions Tools dispatcher map
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>);
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<VertexAiChatActions>>;
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
    protected continueQueue(control: OpenAiDispatchControl, actions: VertexAiChatActions): Promise<void>;
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
    protected updateConfig(control: OpenAiDispatchControl, state: ChatState<VertexAiAssistantConfig, ChatData>, update: (soFar: VertexAiAssistantConfig) => Partial<VertexAiAssistantConfig>): Promise<void>;
}
