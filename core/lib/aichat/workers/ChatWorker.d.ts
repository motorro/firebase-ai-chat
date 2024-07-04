import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatMeta, Meta } from "../data/Meta";
import { BoundChatCommand, ChatAction, ChatCommand } from "../data/ChatCommand";
import { firestore } from "firebase-admin";
import PartialWithFieldValue = firestore.PartialWithFieldValue;
/**
 * Dispatch control structure passed to processing function
 */
export interface DispatchControl<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Updates database if dispatch state is valid
     * @param update Update function
     * @return True if state was updated or false if update attempt is conflicting with the dispatch logic
     */
    safeUpdate: (update: (tx: FirebaseFirestore.Transaction, updateChatState: (state: PartialWithFieldValue<ChatState<AssistantConfig, DATA, CM>>) => void) => Promise<void>) => Promise<boolean>;
    /**
     * Enqueue arbitrary chat command
     * @param command Command to schedule
     */
    schedule: (command: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => Promise<void>;
    /**
     * Continues queue if dispatch sequence is valid
     * @param next
     */
    continueQueue: (next: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => Promise<boolean>;
    /**
     * Completes queue if dispatch sequence is valid
     */
    completeQueue: () => Promise<void>;
}
/**
 * Chat worker
 * Use to dispatch queue requests
 */
export interface ChatWorker {
    /**
     * Dispatches command
     * @param req Dispatch request
     * @param onQueueComplete Called when `req` queue is dispatched
     */
    dispatch(req: Request<unknown>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
