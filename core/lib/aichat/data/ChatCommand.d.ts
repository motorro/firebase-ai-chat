import { ChatCommandData } from "./ChatCommandData";
/**
 * Chat command type
 */
export interface ChatCommand<A> extends Record<string, unknown> {
    readonly commonData: ChatCommandData;
    readonly actionData: A;
}
export declare function isChatCommand(data: unknown): data is ChatCommand<unknown>;
/**
 * Chat command bound to queue
 */
export interface BoundChatCommand<A> {
    readonly queueName: string;
    readonly command: ChatCommand<A>;
}
export declare function isBoundChatCommand<A>(data: unknown): data is BoundChatCommand<A>;
