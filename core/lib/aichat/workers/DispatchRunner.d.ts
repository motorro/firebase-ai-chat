import { Request } from "firebase-functions/lib/common/providers/tasks";
import { BoundChatCommand, ChatCommand } from "../data/ChatCommand";
import { firestore } from "firebase-admin";
import { TaskScheduler } from "../TaskScheduler";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { ChatCleaner } from "./ChatCleaner";
import { ChatMeta } from "../data/Meta";
import PartialWithFieldValue = firestore.PartialWithFieldValue;
/**
 * Runs task locking on current dispatch and run
 */
export declare class DispatchRunner<A, AC extends AssistantConfig, DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    protected readonly cleaner: ChatCleaner;
    protected readonly logData: boolean;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param cleaner Chat cleaner
     * @param logData If true, logs data when dispatching
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean);
    dispatchWithCheck(req: Request<ChatCommand<A>> | Request<BoundChatCommand<A>>, run: (soFar: ChatState<AC, DATA, CM>, command: ChatCommand<A> | BoundChatCommand<A>, safeUpdate: (update: (tx: FirebaseFirestore.Transaction, updateState: (update: PartialWithFieldValue<ChatState<AssistantConfig, DATA, CM>>) => void) => Promise<void>) => Promise<boolean>) => Promise<void>): Promise<void>;
}
