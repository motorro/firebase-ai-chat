import { OpenAiChatAction } from "../data/OpenAiChatAction";
export interface ActionWorker {
    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    isSupportedAction(action: unknown): action is OpenAiChatAction;
}
