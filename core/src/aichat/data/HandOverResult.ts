import {AssistantConfig} from "./ChatState";
import {ChatMeta} from "./Meta";

/**
 * Hand-over result
 */
export interface HandOverResult<CM extends ChatMeta = ChatMeta> {
    formerAssistantConfig: AssistantConfig,
    formerChatMeta: CM | null
}
