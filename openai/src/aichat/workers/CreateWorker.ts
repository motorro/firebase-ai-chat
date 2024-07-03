import {
    ChatState,
    ChatData,
    DispatchControl,
    tagLogger, ChatCleanupRegistrar, TaskScheduler, ChatCleaner
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";
import {AiWrapper} from "../AiWrapper";

const logger = tagLogger("CreateWorker");

export class CreateWorker extends OpenAiQueueWorker {
    private readonly cleanupRegistrar: ChatCleanupRegistrar;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        cleaner: ChatCleaner,
        logData: boolean,
        cleanupRegistrar: ChatCleanupRegistrar
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.cleanupRegistrar = cleanupRegistrar;
    }

    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "create" === action;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        if (state.config.assistantConfig.threadId) {
            logger.d("Already has a thread:", state.config.assistantConfig.threadId);
        } else {
            logger.d("Creating thread...");
            const threadId = await this.wrapper.createThread({
                chat: command.commonData.chatDocumentPath
            });
            logger.d("Thread created:", threadId);
            const newConfig = await this.updateConfig(
                control,
                state,
                () => ({threadId: threadId})
            );
            await this.cleanupRegistrar.register({
                ...command,
                actionData: [{name: "cleanup", config: newConfig}]
            });
        }
        await this.continueNextInQueue(control, command);
    }
}
