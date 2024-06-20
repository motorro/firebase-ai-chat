import {ChatCommand, ChatWorker, tagLogger} from "@motorro/firebase-ai-chat-core";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper} from "../AiWrapper";
import {Cleanup, isCleanupAction} from "../data/VertexAiChatAction";
import {engineId} from "../../engineId";

const logger = tagLogger("CleanupWorker");

/**
 * Cleans-up OpenAI thread on hand-back
 */
export class CleanupWorker implements ChatWorker {
    static isSupportedAction(action: unknown): action is Cleanup {
        return isCleanupAction(action);
    }

    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper: AiWrapper) {
        this.wrapper = wrapper;
    }

    private getAction(req: Request<ChatCommand<unknown>>): Cleanup | undefined {
        const action = "engine" in req.data && engineId === req.data.engine
            && Array.isArray(req.data.actionData)
            && req.data.actionData[0];

        if (isCleanupAction(action)) {
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
