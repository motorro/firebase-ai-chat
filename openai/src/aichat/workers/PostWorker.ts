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
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";

class PostWorker extends OpenAiQueueWorker {
    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Posting messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messages = await this.getMessages(data.chatDocumentPath, data.dispatchId);
        let latestMessageId: string | undefined = undefined;
        for (const message of messages) {
            latestMessageId = await this.wrapper.postMessage(threadId, message.text);
        }

        if (undefined !== latestMessageId) {
            await this.updateConfig(
                control,
                state,
                (soFar) => ({lastMessageId: latestMessageId})
            );
        }

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}

export class PostFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "post" === action;
    }
    create(): ChatWorker {
        return new PostWorker(this.firestore, this.scheduler, this.wrapper);
    }
}

