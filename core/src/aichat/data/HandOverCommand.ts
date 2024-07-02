import {AssistantConfig} from "./ChatState";
import {ChatAction, ChatCommand, isChatCommand} from "./ChatCommand";
import {NewMessage} from "./NewMessage";
import {ChatMeta} from "./Meta";

/**
 * Common hand-over command
 */
export interface HandOverCommand<CM extends ChatMeta = ChatMeta> extends ChatCommand<ChatAction> {
    readonly actionData: "handOver"
    readonly config: AssistantConfig
    readonly messages?: ReadonlyArray<NewMessage>
    readonly chatMeta?: CM | null
}

/**
 * Common hand-back command
 */
export interface HandBackCommand extends ChatCommand<ChatAction> {
    actionData: "handBack"
    readonly messages?: ReadonlyArray<NewMessage>
}

/**
 * Checks if data is a HandOverCommand
 * @param data Data to check
 * @return True if data is HandOverCommand
 */
export function isHandOverCommand(data: unknown): data is HandOverCommand {
    return isChatCommand(data) && "handOver" === data.actionData;
}

/**
 * Checks if data is a HandBackCommand
 * @param data Data to check
 * @return True if data is HandBackCommand
 */
export function isHandBackCommand(data: unknown): data is HandBackCommand {
    return isChatCommand(data) && "handBack" === data.actionData;
}
