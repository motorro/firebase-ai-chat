import {NewMessage} from "@motorro/firebase-ai-chat-core";

/**
 * AI Messages response
 */
export interface AiMessages {
    /**
     * A list of messages
     */
    readonly messages: ReadonlyArray<[string, NewMessage]>,
    /**
     * The ID of latest message to optimize retrievals
     */
    readonly latestMessageId?: string
}
