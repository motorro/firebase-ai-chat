import {
    BaseChatWorker, ChatCleaner, ChatCommand,
    ChatData,
    ChatState, DispatchControl,
    tagLogger,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {AiWrapper} from "../AiWrapper";
import {ChatConfig} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatConfig";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("OpenAiQueueWorker");

export type OpenAiDispatchControl = DispatchControl<ChatData>;

export abstract class OpenAiQueueWorker extends BaseChatWorker<OpenAiChatActions, OpenAiAssistantConfig, ChatData> {
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
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatActions>> {
        // Handled in common worker and factory
        return true;
    }

    protected async continueNextInQueue(control: OpenAiDispatchControl, currentCommand: OpenAiChatCommand): Promise<void> {
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
    protected async continueQueue(control: OpenAiDispatchControl, command: OpenAiChatCommand): Promise<void> {
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
    private async runSwitchToUser(control: OpenAiDispatchControl): Promise<void> {
        logger.d("Switching to user input");
        await control.safeUpdate(async (_tx, updateChatState) => updateChatState({
            status: "userInput"
        }));
    }

    /**
     * Updates config
     * @param control Chat control
     * @param state Current state
     * @param update Builds config changes
     * @protected
     */
    protected async updateConfig(
        control: OpenAiDispatchControl,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        update: (soFar: OpenAiAssistantConfig) => Partial<OpenAiAssistantConfig>
    ): Promise<OpenAiAssistantConfig> {
        const assistantConfig = {
            ...state.config.assistantConfig,
            ...(update(state.config.assistantConfig))
        };
        const config: ChatConfig<OpenAiAssistantConfig> = {
            ...state.config,
            assistantConfig: assistantConfig
        };
        await control.safeUpdate(async (_tx, updateChatState) => updateChatState({
            config: config
        }));
        return assistantConfig;
    }
}
