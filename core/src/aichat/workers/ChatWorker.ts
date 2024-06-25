import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {ChatMeta, Meta} from "../data/Meta";
import {BoundChatCommand, ChatAction, ChatCommand} from "../data/ChatCommand";

/**
 * Dispatch control structure passed to processing function
 */
export interface DispatchControl<A, DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Updates chat state if corresponds with dispatch sequence
     * @param state Partial state update
     * @return True if state was updated or false if update attempt is conflicting with the dispatch logic
     */
    updateChatState: (state: Partial<ChatState<AssistantConfig, DATA, CM>>) => Promise<ChatState<AssistantConfig, DATA, CM>>
    /**
     * Enqueue arbitrary chat command
     * @param command Command to schedule
     */
    schedule: (command: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => Promise<void>
    /**
     * Continues queue if dispatch sequence is valid
     * @param next
     */
    continueQueue: (next: ChatCommand<A> | BoundChatCommand<A>) => Promise<boolean>,
    /**
     * Completes queue if dispatch sequence is valid
     */
    completeQueue: () => Promise<void>
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
    dispatch(
        req: Request<unknown>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean>
}
