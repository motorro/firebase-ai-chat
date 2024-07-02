import { firestore } from "firebase-admin";
import { ChatMessage } from "../data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { TaskScheduler } from "../TaskScheduler";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatMeta, Meta } from "../data/Meta";
import { ChatCommand } from "../data/ChatCommand";
import { ChatWorker, DispatchControl } from "./ChatWorker";
import { ChatCleaner } from "./ChatCleaner";
import { NewMessage } from "../data/NewMessage";
import { MessageMiddleware } from "../middleware/MessageMiddleware";
/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
export declare abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ChatWorker {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    private readonly runner;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     */
    protected constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean);
    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
    /**
     * Checks if command passed in `req` is supported by this dispatcher
     * @param req Dispatch request
     * @returns true if request is supported
     * @protected
     */
    protected abstract isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<A>>;
    /**
     * Dispatch template
     * @param command Command to dispatch
     * @param state Current chat state
     * @param control Continuation control
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected abstract doDispatch(command: ChatCommand<A>, state: ChatState<AC, DATA, CM>, control: DispatchControl<DATA, CM>): Promise<void>;
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @protected
     */
    protected getMessageCollection(chatDocumentPath: string): CollectionReference<ChatMessage>;
    /**
     * Creates chat message query
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Collection query to get chat messages
     * @protected
     */
    private getThreadMessageQuery;
    /**
     * Retrieves chat messages
     * @param chatDocumentPath Chat document path
     * @param dispatchId Chat dispatch ID if retrieving messages inserted in current dispatch
     * @return Chat messages if any
     * @protected
     */
    protected getMessages(chatDocumentPath: string, dispatchId?: string): Promise<ReadonlyArray<ChatMessage>>;
    /**
     * Saves chat messages
     * @param tx Update transaction
     * @param nextInBatchIndex Next index in batch
     * @param ownerId Chat owner
     * @param chatDocumentPath Chat document path
     * @param dispatchId Dispatch ID
     * @param sessionId Session ID
     * @param messages A list of messages to save
     * @param chatMeta Chat metadata
     * @protected
     */
    private saveMessages;
    /**
     * Runs AI message processing
     * @param command Chat command
     * @param chatState Current chat state
     * @param defaultProcessor Default message processor
     * @param control Dispatch control
     * @param middleware Message middleware
     * @param messages Messages to process
     * @protected
     */
    protected processMessages(command: ChatCommand<A>, chatState: ChatState<AssistantConfig, DATA, CM>, defaultProcessor: MessageMiddleware<DATA, CM>, control: DispatchControl<DATA, CM>, middleware: ReadonlyArray<MessageMiddleware<DATA, CM>>, messages: ReadonlyArray<NewMessage>): Promise<void>;
    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    private dispatchWithCheck;
}
