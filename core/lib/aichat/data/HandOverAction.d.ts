import { AssistantConfig } from "./ChatState";
import { NewMessage } from "./NewMessage";
import { ChatMeta } from "./Meta";
/**
 * Common hand-over action
 */
export interface HandOverAction<CM extends ChatMeta = ChatMeta> {
    readonly name: "handOver";
    readonly config: AssistantConfig;
    readonly messages?: ReadonlyArray<NewMessage>;
    readonly chatMeta?: CM | null;
}
/**
 * Common hand-back action
 */
export interface HandBackAction {
    name: "handBack";
    readonly messages?: ReadonlyArray<NewMessage>;
}
/**
 * Checks if data is a HandOverAction
 * @param data Data to check
 * @return True if data is HandOverAction
 */
export declare function isHandOverAction(data: unknown): data is HandOverAction;
/**
 * Checks if data is a HandBackAction
 * @param data Data to check
 * @return True if data is HandBackAction
 */
export declare function isHandBackAction(data: unknown): data is HandBackAction;
