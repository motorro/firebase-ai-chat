import {ChatCommand, ChatWorker, logger} from "@motorro/firebase-ai-chat-core";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper} from "../AiWrapper";
import {HandBackCleanup, isHandBackCleanupAction, OpenAiChatAction} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";

/**
 * Cleans-up OpenAI thread on hand-back
 */
class HandBackCleanupWorker implements ChatWorker {
    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param wrapper AI wrapper
     */
    constructor(wrapper: AiWrapper) {
        this.wrapper = wrapper;
    }

    private getAction(req: Request<ChatCommand<unknown>>): HandBackCleanup | undefined {
        const action = "engine" in req.data && "openai" === req.data.engine
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

export class HandBackCleanupFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isHandBackCleanupAction(action);
    }
    create(): ChatWorker {
        return new HandBackCleanupWorker(this.wrapper);
    }
}
