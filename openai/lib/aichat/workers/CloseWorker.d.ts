import { ChatCommandData, ChatState, ChatData, DispatchControl } from "@motorro/firebase-ai-chat-core";
import { OpenAiAssistantConfig } from "../data/OpenAiAssistantConfig";
import { OpenAiChatActions } from "../data/OpenAiChatAction";
import { BaseOpenAiWorker } from "./BaseOpenAiWorker";
export declare class CloseWorker extends BaseOpenAiWorker {
    protected isSupportedAction(action: string): boolean;
    doDispatch(actions: OpenAiChatActions, data: ChatCommandData, state: ChatState<OpenAiAssistantConfig, ChatData>, control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>): Promise<void>;
}
