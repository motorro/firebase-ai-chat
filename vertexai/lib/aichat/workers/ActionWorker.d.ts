import { VertexAiChatAction } from "../data/VertexAiChatAction";
export interface ActionWorker {
    /**
     * Is supported Vertex AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    isSupportedAction(action: unknown): action is VertexAiChatAction;
}
