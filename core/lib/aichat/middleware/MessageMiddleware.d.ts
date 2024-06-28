import { NewMessage } from "../data/NewMessage";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { BoundChatCommand, ChatAction, ChatCommand } from "../data/ChatCommand";
import { ChatMeta } from "../data/Meta";
import { firestore } from "firebase-admin";
import PartialWithFieldValue = firestore.PartialWithFieldValue;
/**
 * Updatable part of chat data
 */
export type PartialChatState<DATA extends ChatData, CM extends ChatMeta = ChatMeta> = PartialWithFieldValue<Pick<ChatState<AssistantConfig, DATA, CM>, "config" | "status" | "data" | "meta" | "sessionId">>;
export interface MessageProcessingControl<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Updates database if dispatch state is valid
     * @param update Update function
     * @return True if state was updated or false if update attempt is conflicting with the dispatch logic
     */
    safeUpdate: (update: (tx: FirebaseFirestore.Transaction, updateState: (state: PartialChatState<DATA, CM>) => void, saveMessages: (messages: ReadonlyArray<NewMessage>) => void) => Promise<void>) => Promise<boolean>;
    /**
     * Runs next processor in chain
     * @param messages Message to process
     */
    next: (messages: ReadonlyArray<NewMessage>) => Promise<void>;
    /**
     * Resets current processing queue and sets a new command to execute
     * @param next Next command to execute.
     */
    enqueue: (command: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => Promise<void>;
    /**
     * Completes queue if dispatch sequence is valid
     */
    completeQueue: () => Promise<void>;
}
/**
 * Middleware that is called in a worker when a message is retrieved from AI before putting it to chat
 * May alter message processing if any special message is received
 */
export interface MessageMiddleware<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Processes message
     * @param messages Message received from AI
     * @param chatDocumentPath Chat document path
     * @param chatState Chat state
     * @param control Message processing control
     */
    (messages: ReadonlyArray<NewMessage>, chatDocumentPath: string, chatState: ChatState<AssistantConfig, DATA, CM>, control: MessageProcessingControl<DATA, CM>): Promise<void>;
}
