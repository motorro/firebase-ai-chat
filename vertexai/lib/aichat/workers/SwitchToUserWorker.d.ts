import { ChatData, ChatState, DispatchControl } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { VertexAiChatActions } from "../data/VertexAiChatAction";
import { VertexAiQueueWorker } from "./VertexAiQueueWorker";
import { VertexAiChatCommand } from "../data/VertexAiChatCommand";
export declare class SwitchToUserWorker extends VertexAiQueueWorker {
    static isSupportedAction(action: unknown): action is "switchToUserInput";
    doDispatch(command: VertexAiChatCommand, _state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>): Promise<void>;
}
