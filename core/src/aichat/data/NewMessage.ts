import {Meta} from "./Meta";

/**
 * New message to post
 */
export type NewMessage = string | StructuredMessage;

/**
 * Message with metadata
 */
export interface StructuredMessage {
    readonly text: string
    readonly data?: Readonly<Record<string, unknown>> | null
    readonly meta?: Meta | null
}

export function isStructuredMessage(data: unknown): data is StructuredMessage {
    return "object" === typeof data && null != data && "text" in data && "string" === typeof data.text;
}
