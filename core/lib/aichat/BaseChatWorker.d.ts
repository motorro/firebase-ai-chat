import { firestore } from "firebase-admin";
import { ChatCommandData } from "./data/ChatCommandData";
import { ChatMessage } from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import { AssistantConfig, ChatData, ChatState } from "./data/ChatState";
import { ChatCommand, TaskScheduler } from "./TaskScheduler";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { Meta } from "./data/Meta";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare abstract class BaseChatWorker<A, AC extends AssistantConfig, DATA extends ChatData> {
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
     * Checks if command is supported
     * @param req Request to check
     * @protected
     */
    protected abstract isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<A>>;
    /**
     * Dispatches action
     * @param action
     * @param data
     * @param state
     * @protected
     */
    protected abstract doDispatch(action: A, data: ChatCommandData, state: ChatState<AC, DATA>): Promise<Partial<ChatState<AC, DATA>> | null>;
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @private
     */
    protected getMessageCollection(chatDocumentPath: string): CollectionReference<ChatMessage>;
    /**
     * Runs dispatch with concurrency and duplication check
     * https://mm.tt/app/map/3191589380?t=UdskfqiKnl
     * @param req Task request
     * @param onQueueComplete Task queue complete handler
     * @param processAction Dispatch function
     * @private
     */
    protected dispatchWithCheck(req: Request<ChatCommand<A>>, onQueueComplete: ((chatDocumentPath: string, meta: Meta | null) => void | Promise<void>) | undefined, processAction: (action: A, data: ChatCommandData, state: ChatState<AC, DATA>) => Promise<Partial<ChatState<AC, DATA>> | null>): Promise<void>;
}
