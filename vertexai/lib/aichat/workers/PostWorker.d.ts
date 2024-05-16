import { ChatCommandData, ChatState, ChatData, DispatchControl } from "@motorro/firebase-ai-chat-core";
import { VertexAiAssistantConfig } from "../data/VertexAiAssistantConfig";
import { VertexAiChatAction, VertexAiChatActions } from "../data/VertexAiChatAction";
import { BaseVertexAiWorker } from "./BaseVertexAiWorker";
declare abstract class BasePostWorker extends BaseVertexAiWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction;
    /**
     * Retrieves messages
     * @param data Command data
     * @param action Processed action
     * @protected
     */
    protected abstract doGetMessages(data: ChatCommandData, action: VertexAiChatAction): Promise<ReadonlyArray<string>>;
    doDispatch(actions: VertexAiChatActions, data: ChatCommandData, state: ChatState<VertexAiAssistantConfig, ChatData>, control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>): Promise<void>;
}
export declare class PostWorker extends BasePostWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction;
    protected doGetMessages(data: ChatCommandData): Promise<ReadonlyArray<string>>;
}
export declare class ExplicitPostWorker extends BasePostWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction;
    protected doGetMessages(_data: ChatCommandData, action: VertexAiChatAction): Promise<ReadonlyArray<string>>;
}
export {};
