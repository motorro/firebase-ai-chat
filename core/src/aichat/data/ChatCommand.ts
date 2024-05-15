import {ChatCommandData} from "./ChatCommandData";

/**
 * Chat command type
 */
export interface ChatCommand<A> extends Record<string, unknown>{
    readonly commonData: ChatCommandData
    readonly actionData: A
}

/**
 * Chat command bound to queue
 */
export interface BoundChatCommand<A> {
    readonly queueName: string
    readonly command: ChatCommand<A>
}

export function isBoundChatCommand<A>(data: unknown): data is BoundChatCommand<A> {
    return "object" === typeof data && null !== data
        && "queueName" in data && "string" === typeof data.queueName
        && "command" in data && "object" === typeof data.command;
}
