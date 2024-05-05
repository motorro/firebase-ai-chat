import { firestore } from "firebase-admin";
import { ChatCommandData } from "../data/ChatCommandData";
import { ChatMessage } from "../data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { TaskScheduler } from "../TaskScheduler";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { Meta } from "../data/Meta";
import { ChatCommand } from "../data/ChatCommand";
import { ChatWorker, DispatchControl } from "./ChatWorker";
/**
 * Basic `OpenAiChatWorker` implementation that maintains chat state and dispatch runs
 */
export declare abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData> implements ChatWorker {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     */
    protected constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler);
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
     * @param action Action to perform
     * @param data Command data
     * @param state Current chat state
     * @param control Continuation control
     * @return Partial chat state to set after dispatched
     * @protected
     */
    protected abstract doDispatch(action: A, data: ChatCommandData, state: ChatState<AC, DATA>, control: DispatchControl<A, AC, DATA>): Promise<void>;
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
    protected getNextBatchSortIndex(chatDocumentPath: string, dispatchId?: string): Promise<number>;
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
