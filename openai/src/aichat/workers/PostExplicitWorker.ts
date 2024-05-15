import {
    ChatCommandData,
    ChatData,
    ChatError,
    ChatState,
    ChatWorker,
    DispatchControl,
    logger
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {isPostExplicitAction, OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";

class PostExplicitWorker extends OpenAiQueueWorker {
    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        const postExplicit = actions[0];
        if (isPostExplicitAction(postExplicit)) {
            logger.d("Posting explicit messages...");
            const threadId = state.config.assistantConfig.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }

            const messages = postExplicit.messages;
            let latestMessageId: string | undefined = undefined;
            for (const message of messages) {
                latestMessageId = await this.wrapper.postMessage(threadId, message);
            }

            if (undefined !== latestMessageId) {
                await this.updateConfig(
                    control,
                    state,
                    () => ({lastMessageId: latestMessageId})
                );
            }

            await this.continueQueue(control, actions.slice(1, actions.length));
        } else {
            return Promise.reject(new ChatError("unknown", true, "Expected explicit post action", JSON.stringify(postExplicit)));
        }
    }
}

export class PostExplicitFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isPostExplicitAction(action);
    }
    create(): ChatWorker {
        return new PostExplicitWorker(this.firestore, this.scheduler, this.wrapper);
    }
}

