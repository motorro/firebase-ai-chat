import { Request } from "firebase-functions/lib/common/providers/tasks";
import { BoundChatCommand, ChatCommand } from "../data/ChatCommand";
import { TaskScheduler } from "../TaskScheduler";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
/**
 * Runs task locking on current dispatch and run
 */
export declare class DispatchRunner<A, AC extends AssistantConfig, DATA extends ChatData> {
    protected readonly db: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheculer
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler);
    dispatchWithCheck(req: Request<ChatCommand<A>> | Request<BoundChatCommand<A>>, run: (soFar: ChatState<AC, DATA>, command: ChatCommand<A> | BoundChatCommand<A>, updateState: (update: Partial<ChatState<AC, DATA>>) => Promise<boolean>) => Promise<void>): Promise<void>;
}
