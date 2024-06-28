import { ChatCommandData } from "./ChatCommandData";
/**
 * Chat action
 */
export type ChatAction = unknown;
/**
 * Chat command type
 */
export interface ChatCommand<out A extends ChatAction> extends Record<string, unknown> {
    readonly commonData: ChatCommandData;
    readonly actionData: A;
}
export declare function isChatCommand(data: unknown): data is ChatCommand<unknown>;
/**
 * Chat command bound to queue
 */
export interface BoundChatCommand<out A extends ChatAction> {
    readonly queueName: string;
    readonly command: ChatCommand<A>;
}
export declare function isBoundChatCommand<A extends ChatAction>(data: unknown): data is BoundChatCommand<A>;
