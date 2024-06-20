import {
    ChatCleaner,
    ChatCleanupRegistrar,
    ChatData,
    ChatState,
    DispatchControl,
    tagLogger,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiQueueWorker} from "./VertexAiQueueWorker";
import {VertexAiChatCommand} from "../data/VertexAiChatCommand";
import {AiWrapper} from "../AiWrapper";

const logger = tagLogger("CreateWorker");

export class CreateWorker extends VertexAiQueueWorker {
    private readonly cleanupRegistrar: ChatCleanupRegistrar;

    static isSupportedAction(action: unknown): action is "create" {
        return "create" === action;
    }

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

    async doDispatch(
        command: VertexAiChatCommand,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
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
                actionData: {name: "cleanup", config: newConfig}
            });
        }
        await this.continueNextInQueue(control, command);
    }
}
