import { ChatCommandData, ChatState, ChatData, DispatchControl } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { VertexAiChatAction, VertexAiChatActions } from "../data/VertexAiChatAction";
import { BaseVertexAiWorker } from "./BaseVertexAiWorker";
export declare class SwitchToUserWorker extends BaseVertexAiWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction;
    doDispatch(actions: VertexAiChatActions, _data: ChatCommandData, _state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>): Promise<void>;
}
