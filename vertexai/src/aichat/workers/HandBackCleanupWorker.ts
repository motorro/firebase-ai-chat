import {ChatCommand, ChatWorker, logger} from "@motorro/firebase-ai-chat-core";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper} from "../AiWrapper";
import {HandBackCleanup, isHandBackCleanupAction} from "../data/VertexAiChatAction";
import {engineId} from "../../engineId";

/**
 * Cleans-up OpenAI thread on hand-back
 */
export class HandBackCleanupWorker implements ChatWorker {
    static isSupportedAction(action: unknown): action is HandBackCleanup {
        return isHandBackCleanupAction(action);
    }

    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper: AiWrapper) {
        this.wrapper = wrapper;
    }

    private getAction(req: Request<ChatCommand<unknown>>): HandBackCleanup | undefined {
        const action = "engine" in req.data && engineId === req.data.engine
            && Array.isArray(req.data.actionData)
            && req.data.actionData[0];

        if (isHandBackCleanupAction(action)) {
            return action;
        }
        return undefined;
    }

    async dispatch(req: Request<ChatCommand<unknown>>): Promise<boolean> {
        const action = this.getAction(req);
        if (undefined !== action) {
            logger.d("Deleting thread...");
            const threadId = action.config.threadId;
            if (undefined !== threadId) {
                await this.wrapper.deleteThread(threadId);
            }
            return true;
        }
        return false;
    }
}
