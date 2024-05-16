import { ChatCommand, ChatWorker } from "@motorro/firebase-ai-chat-core";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { AiWrapper } from "../AiWrapper";
/**
 * Cleans-up OpenAI thread on hand-back
 */
export declare class HandBackCleanupWorker implements ChatWorker {
    protected readonly wrapper: AiWrapper;
    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper: AiWrapper);
    private getAction;
    dispatch(req: Request<ChatCommand<unknown>>): Promise<boolean>;
}
