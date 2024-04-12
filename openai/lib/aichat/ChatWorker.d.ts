import { Request } from "firebase-functions/lib/common/providers/tasks";
import { AiWrapper, BaseChatWorker, ChatCommand, ChatData, ChatState, TaskScheduler, ToolsDispatcher } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatAction } from "./data/OpenAiChatAction";
import { OpenAiAssistantConfig } from "./data/OpenAiAssistantConfig";
import { ChatCommandData } from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class ChatWorker extends BaseChatWorker<OpenAiChatAction, OpenAiAssistantConfig, ChatData> {
    private readonly wrapper;
    private readonly dispatchers;
    private readonly defaultDispatcher;
    /**
     * Supported actions
     * @private
     */
    private static SUPPORTED_ACTIONS;
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
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<OpenAiChatAction>>;
    /**
     * Dispatch template
     * @param action Action to perform
     * @param data Command data
     * @param state Current chat state
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected doDispatch(action: OpenAiChatAction, data: ChatCommandData, state: ChatState<OpenAiAssistantConfig, ChatData>): Promise<Partial<ChatState<OpenAiAssistantConfig, ChatData>> | null>;
    /**
     * Creates thread
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private runCreateThread;
    /**
     * Posts user messages of current dispatch
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private runPostMessages;
    /**
     * Runs assistant
     * @param state Chat state
     * @private
     */
    private runRun;
    /**
     * Retrieves new messages
     * @param commandData Command data
     * @param state Chat state
     * @private
     */
    private runRetrieve;
    /**
     * Switches to user input.
     * Made as a separate command as we can come here in several ways
     * @private
     */
    private runSwitchToUser;
    /**
     * Closes chat
     * @param state Chat state
     * @private
     */
    private runClose;
}
