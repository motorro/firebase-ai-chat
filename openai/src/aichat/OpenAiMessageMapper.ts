import {isStructuredMessage, NewMessage} from "@motorro/firebase-ai-chat-core";
import {Message, MessageCreateParams} from "openai/src/resources/beta/threads/messages";

/**
 * OpenAI message parts that are sent from user to AI
 */
export type UserMessageParts = Pick<MessageCreateParams, "content" | "attachments" | "metadata">

/**
 * Maps messages to/from AI
 */
export interface OpenAiMessageMapper {
    /**
     * Maps chat data message parts to OpenAI
     * @param message Message to map to OpenAI
     * @returns OpenAI message structure
     */
    toAi(message: NewMessage): UserMessageParts

    /**
     * Maps OpenAI message parts to chat message
     * @param message Message to map to chat format
     * @returns Chat message structure
     */
    fromAi(message: Message): NewMessage | undefined
}

export const DefaultMessageMapper: OpenAiMessageMapper = {
    toAi(message: NewMessage): UserMessageParts {
        if (isStructuredMessage(message)) {
            return {
                content: message.text,
                metadata: message.meta
            };
        }
        return {
            content: String(message)
        };
    },

    fromAi(message: Message): NewMessage | undefined {
        const text: Array<string> = [];
        for (const content of message.content) {
            if ("text" === content.type) {
                text.push(content.text.value);
            }
        }
        return {
            text: text.join("\n"),
            meta: <Record<string, unknown>>message.metadata
        };
    }
}