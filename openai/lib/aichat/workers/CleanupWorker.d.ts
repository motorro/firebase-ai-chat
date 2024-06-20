import { ChatCommand, ChatWorker } from "@motorro/firebase-ai-chat-core";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { AiWrapper } from "../AiWrapper";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
/**
 * Cleans-up OpenAI thread on hand-back
 */
export declare class CleanupWorker implements ChatWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction;
    protected readonly wrapper: AiWrapper;
    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper: AiWrapper);
    private getAction;
    dispatch(req: Request<ChatCommand<unknown>>): Promise<boolean>;
}
