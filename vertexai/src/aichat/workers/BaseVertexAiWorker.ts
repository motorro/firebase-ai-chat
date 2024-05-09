import {
    BaseChatWorker, ChatCommand,
    ChatData, ChatState, logger,
    TaskScheduler,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {VertexAiChatAction, VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {OpenAiDispatchControl} from "../VertexAiChatWorker";
import {AiWrapper} from "../AiWrapper";
import {VertexAiSystemInstructions} from "../data/VertexAiSystemInstructions";
import {ChatConfig} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatConfig";
import {ActionWorker} from "./ActionWorker";

export abstract class BaseVertexAiWorker extends BaseChatWorker<VertexAiChatActions, VertexAiAssistantConfig, ChatData> implements ActionWorker {
    protected readonly wrapper: AiWrapper;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    protected readonly instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>;

    protected readonly defaultDispatcher: ToolsDispatcher<ChatData> = (data) => Promise.resolve(data);

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions Tools dispatcher map
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>
    ) {
        super(firestore, scheduler);
        this.wrapper = wrapper;
        this.instructions = instructions;
    }

    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<VertexAiChatActions>> {
        return "engine" in req.data && "vertexai" === req.data.engine
            && Array.isArray(req.data.actionData)
            && undefined !== req.data.actionData[0]
            && this.isSupportedAction(req.data.actionData[0]);
    }

    /**
     * Is supported Vertex AI command
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    abstract isSupportedAction(action: unknown): action is VertexAiChatAction

    /**
     * Runs some actions at once so there is no extra scheduling for trivial commands
     * @param control Dispatch control
     * @param actions Action queue
     * @protected
     */
    protected async continueQueue(control: OpenAiDispatchControl, actions: VertexAiChatActions): Promise<void> {
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
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        update: (soFar: VertexAiAssistantConfig) => Partial<VertexAiAssistantConfig>
    ): Promise<void> {
        const config: ChatConfig<VertexAiAssistantConfig> = {
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
