import {firestore} from "firebase-admin";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    AiWrapper, BaseChatWorker, ChatCommand, ChatData, ChatError, ChatState, logger,
    TaskScheduler,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {OpenAiChatAction} from "./data/OpenAiChatAction";
import {OpenAiAssistantConfig} from "./data/OpenAiAssistantConfig";
import {ChatCommandData} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
import FieldValue = firestore.FieldValue;

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class ChatWorker extends BaseChatWorker<OpenAiChatAction, OpenAiAssistantConfig, ChatData> {
    private readonly wrapper: AiWrapper;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;

    private readonly defaultDispatcher: ToolsDispatcher<ChatData> = (data) => Promise.resolve({data: data});

    /**
     * Supported actions
     * @private
     */
    private static SUPPORTED_ACTIONS: ReadonlyArray<string> = [
        "create", "post", "run", "retrieve", "switchToUserInput", "close"
    ];

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>
    ) {
        super(firestore, scheduler);
        this.wrapper = wrapper;
        this.dispatchers = dispatchers;
    }

    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatAction>> {
        return "engine" in req.data && "openai" === req.data.engine
            && req.data.actions.every((action) => "string" === typeof action && ChatWorker.SUPPORTED_ACTIONS.includes(action));
    }

    /**
     * Dispatch template
     * @param action Action to perform
     * @param data Command data
     * @param state Current chat state
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected async doDispatch(
        action: OpenAiChatAction,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>
    ): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>> | null> {
        switch (action) {
            case "create":
                return await this.runCreateThread(data, state);
            case "post":
                return await this.runPostMessages(data, state);
            case "run":
                return await this.runRun(state);
            case "retrieve":
                return await this.runRetrieve(data, state);
            case "switchToUserInput":
                return await this.runSwitchToUser();
            case "close":
                return await this.runClose(state);
        }
    }

    /**
     * Creates thread
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runCreateThread(
        commandData: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>
    ): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: commandData.chatDocumentPath
        });
        return {
            config: {
                ...state.config,
                threadId: threadId
            }
        };
    }

    /**
     * Posts user messages of current dispatch
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runPostMessages(
        commandData: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>
    ): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messages = await this.getMessages(commandData.chatDocumentPath, commandData.dispatchId);
        let latestMessageId: string | undefined = undefined;
        for (const message of messages) {
            latestMessageId = await this.wrapper.postMessage(threadId, message.text);
        }

        return {
            ...(undefined != latestMessageId ? {lastMessageId: latestMessageId} : {})
        };
    }

    /**
     * Runs assistant
     * @param state Chat state
     * @private
     */
    private async runRun(state: ChatState<OpenAiAssistantConfig, ChatData>): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        logger.d("Running assistant...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const dispatcher = this.dispatchers[state.config.assistantConfig.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatcher);

        return {
            data: newData
        };
    }

    /**
     * Retrieves new messages
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private async runRetrieve(
        commandData: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>
    ): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        logger.d("Retrieving messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messageCollectionRef = this.getMessageCollection(commandData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(commandData.chatDocumentPath, commandData.dispatchId);

        const newMessages = await this.wrapper.getMessages(threadId, state.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach(([id, message], index) => {
            batch.set(
                messageCollectionRef.doc(`ai_${id}`),
                {
                    userId: commandData.ownerId,
                    dispatchId: commandData.dispatchId,
                    author: "ai",
                    text: message,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp()
                }
            );
        });
        await batch.commit();
        return {
            lastMessageId: newMessages.latestMessageId
        };
    }

    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @private
     */
    private async runSwitchToUser(): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        return {
            status: "userInput"
        };
    }

    /**
     * Closes chat
     * @param state Chat state
     * @private
     */
    private async runClose(
        state: ChatState<OpenAiAssistantConfig, ChatData>
    ): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>>> {
        logger.d("Closing chat...");
        const threadId = state.config.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        return {
            status: "complete"
        };
    }
}
