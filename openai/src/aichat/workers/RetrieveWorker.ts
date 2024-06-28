import {
    ChatCleaner,
    ChatData,
    ChatError,
    ChatMeta,
    ChatState,
    DispatchControl,
    MessageMiddleware,
    tagLogger,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";
import {AiWrapper} from "../AiWrapper";

const logger = tagLogger("RetrieveWorker");

export class RetrieveWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "retrieve" === action;
    }
    private readonly messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     * @param messageMiddleware Message processing middleware
     *
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        cleaner: ChatCleaner,
        logData: boolean,
        messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData, ChatMeta>>
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.messageMiddleware = messageMiddleware;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, ChatData>
    ): Promise<void> {
        logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);

        await this.updateConfig(
            control,
            state,
            () => ({lastMessageId: newMessages.latestMessageId})
        );

        await this.processMessages(
            command,
            state,
            async (messages, _document, _state, mpc) => {
                await mpc.safeUpdate(async (_tx, _updateState, saveMessages) => {
                    saveMessages(messages);
                });
                await this.continueNextInQueue(control, command);
            },
            control,
            this.messageMiddleware,
            newMessages.messages.map(([, message]) => message)
        );
    }
}

