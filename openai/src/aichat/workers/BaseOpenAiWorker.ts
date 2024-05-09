import {
    BaseChatWorker, ChatCommand,
    ChatData, ChatState, logger,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiDispatchControl} from "../OpenAiChatWorker";
import {AiWrapper} from "../AiWrapper";
import {ChatConfig} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatConfig";
import {ActionWorker} from "./ActionWorker";

export abstract class BaseOpenAiWorker extends BaseChatWorker<OpenAiChatActions, OpenAiAssistantConfig, ChatData> implements ActionWorker {
    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
    ) {
        super(firestore, scheduler);
        this.wrapper = wrapper;
    }

    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatActions>> {
        return "engine" in req.data && "openai" === req.data.engine
            && Array.isArray(req.data.actionData)
            && undefined !== req.data.actionData[0]
            && this.isSupportedAction(req.data.actionData[0]);
    }

    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    abstract isSupportedAction(action: unknown): action is OpenAiChatAction

    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param actions Action queue
     * @protected
     */
    protected async continueQueue(control: OpenAiDispatchControl, actions: OpenAiChatActions): Promise<void> {
        if (0 === actions.length) {
            logger.d("Queue complete");
            await control.completeQueue();
            return;
        }
        if ("switchToUserInput" === actions[0]) {
            await this.runSwitchToUser(control);
            await this.continueQueue(control, actions.slice(1, actions.length));
            return;
        }
        logger.d("Scheduling next in queue:", JSON.stringify(actions));
        await control.continueQueue(actions);
    }

    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @param control Chat control
     * @protected
     */
    private async runSwitchToUser(control: OpenAiDispatchControl): Promise<void> {
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
        control: OpenAiDispatchControl,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        update: (soFar: OpenAiAssistantConfig) => Partial<OpenAiAssistantConfig>
    ): Promise<void> {
        const config: ChatConfig<OpenAiAssistantConfig> = {
            ...state.config,
            assistantConfig: {
                ...state.config.assistantConfig,
                ...(update(state.config.assistantConfig))
            }
        };
        await control.updateChatState({
            config: config
        });
    }
}
