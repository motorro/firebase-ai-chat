import {
    BaseChatWorker, ChatCleaner, ChatCommand,
    ChatData,
    ChatState, DispatchControl,
    tagLogger,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {AiWrapper} from "../AiWrapper";
import {ChatConfig} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatConfig";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {VertexAiChatCommand} from "../data/VertexAiChatCommand";

const logger = tagLogger("VertexAiQueueWorker");

export type VertexAiDispatchControl = DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>;

export abstract class VertexAiQueueWorker extends BaseChatWorker<VertexAiChatActions, VertexAiAssistantConfig, ChatData> {
    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param cleaner Chat cleaner
     * @param logData If true, logs chat data
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        cleaner: ChatCleaner,
        logData: boolean
    ) {
        super(firestore, scheduler, cleaner, logData);
        this.wrapper = wrapper;
    }

    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<VertexAiChatActions>> {
        // Handled statically
        return true;
    }

    protected async continueNextInQueue(control: VertexAiDispatchControl, currentCommand: VertexAiChatCommand): Promise<void> {
        await this.continueQueue(control, {
            ...currentCommand,
            actionData: currentCommand.actionData.slice(1, currentCommand.actionData.length)
        });
    }

    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param command Next command
     * @protected
     */
    protected async continueQueue(control: VertexAiDispatchControl, command: VertexAiChatCommand): Promise<void> {
        if (0 === command.actionData.length) {
            logger.d("Queue complete");
            await control.completeQueue();
            return;
        }
        if ("switchToUserInput" === command.actionData[0]) {
            await this.runSwitchToUser(control);
            await this.continueNextInQueue(control, command);
            return;
        }

        logger.d("Scheduling next in queue:", JSON.stringify(command));
        const queued = await control.continueQueue(command);
        if (!queued) {
            logger.d("Next command was not queued due to dispatch preconditions. Completitng...");
            await control.completeQueue();
        }
    }

    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @param control Chat control
     * @protected
     */
    private async runSwitchToUser(control: VertexAiDispatchControl): Promise<void> {
        logger.d("Switching to user input");
        await control.updateChatState({
            status: "userInput"
        });
    }

    /**
     * Updates config
     * @param control Chat control
     * @param state Current state
     * @param update Builds config changes
     * @protected
     */
    protected async updateConfig(
        control: VertexAiDispatchControl,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        update: (soFar: VertexAiAssistantConfig) => Partial<VertexAiAssistantConfig>
    ): Promise<VertexAiAssistantConfig> {
        const assistantConfig = {
            ...state.config.assistantConfig,
            ...(update(state.config.assistantConfig))
        };
        const config: ChatConfig<VertexAiAssistantConfig> = {
            ...state.config,
            assistantConfig: assistantConfig

        };
        await control.updateChatState({
            config: config
        });
        return assistantConfig;
    }
}
