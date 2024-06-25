import {NewMessage} from "../data/NewMessage";
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {BoundChatCommand, ChatAction, ChatCommand} from "../data/ChatCommand";
import {ChatMeta} from "../data/Meta";

/**
 * Updatable part of chat data
 */
export type PartialChatState<DATA extends ChatData, CM extends ChatMeta = ChatMeta> = Partial<
    Pick<
        ChatState<AssistantConfig, DATA, CM>,
        "config" | "status" | "data" | "meta"
    >
>

export interface MessageProcessingControl<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Updates chat state if corresponds with dispatch sequence
     * @param state Partial state update
     * @return True if state was updated or false if update attempt is conflicting with the dispatch logic
     */
    updateChatState: (state: PartialChatState<DATA, CM>) => Promise<ChatState<AssistantConfig, DATA, CM>>
    /**
     * Saves message to chat
     * @param messages Messages to save
     */
    saveMessages: (messages: ReadonlyArray<NewMessage>) => Promise<void>
    /**
     * Runs next processor in chain
     * @param messages Message to process
     */
    next: (messages: ReadonlyArray<NewMessage>) => Promise<void>
    /**
     * Resets current processing queue and sets a new command to execute
     * @param next Next command to execute.
     */
    enqueue: (command: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>) => Promise<void>
    /**
     * Completes queue if dispatch sequence is valid
     */
    completeQueue: () => Promise<void>
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
    (
        messages: ReadonlyArray<NewMessage>,
        chatDocumentPath: string,
        chatState: ChatState<AssistantConfig, DATA, CM>,
        control: MessageProcessingControl<DATA, CM>
    ): Promise<void>
}


