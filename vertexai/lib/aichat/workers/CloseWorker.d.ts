import { ChatCommandData, ChatState, ChatData, DispatchControl } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { VertexAiChatActions } from "../data/VertexAiChatAction";
import { BaseVertexAiWorker } from "./BaseVertexAiWorker";
export declare class CloseWorker extends BaseVertexAiWorker {
    protected isSupportedAction(action: string): boolean;
    doDispatch(actions: VertexAiChatActions, data: ChatCommandData, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>): Promise<void>;
}
