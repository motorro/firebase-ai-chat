import {AssistantConfig} from "./ChatState";

/**
 * Open AI chat config
 */
export interface ChatConfig<out C extends AssistantConfig> {
    readonly assistantConfig: C,
    readonly dispatcherId: string,
    readonly threadId?: string
}
