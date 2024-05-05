import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { Meta } from "../data/Meta";
import { ChatCommand } from "../data/ChatCommand";
/**
 * Dispatch control structure passed to processing function
 */
export interface DispatchControl<A, AC extends AssistantConfig, DATA extends ChatData> {
    updateChatState: (state: Partial<ChatState<AC, DATA>>) => Promise<boolean>;
    getContinuation: (action: A) => ChatCommand<A>;
    continueQueue: (action: A) => Promise<void>;
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
    dispatch(req: Request<ChatCommand<unknown>>, onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>): Promise<boolean>;
}
