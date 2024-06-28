import {ChatCommandData} from "./ChatCommandData";

/**
 * Chat action
 */
export type ChatAction = unknown;

/**
 * Chat command type
 */
export interface ChatCommand<out A extends ChatAction> extends Record<string, unknown>{
    readonly commonData: ChatCommandData
    readonly actionData: A
}

export function isChatCommand(data: unknown): data is ChatCommand<unknown> {
    return "object" === typeof data && null !== data
        && "commonData" in data && "object" === typeof data.commonData
        && "actionData" in data && "object" === typeof data.actionData;
}

/**
 * Chat command bound to queue
 */
export interface BoundChatCommand<out A extends ChatAction> {
    readonly queueName: string
    readonly command: ChatCommand<A>
}

export function isBoundChatCommand<A extends ChatAction>(data: unknown): data is BoundChatCommand<A> {
    return "object" === typeof data && null !== data
        && "queueName" in data && "string" === typeof data.queueName
        && "command" in data && "object" === typeof data.command;
}
