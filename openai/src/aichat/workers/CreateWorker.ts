import {
    ChatCommandData,
    ChatState,
    ChatData,
    DispatchControl,
    logger,
    ChatWorker
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";

class CreateWorker extends OpenAiQueueWorker {
    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: data.chatDocumentPath
        });
        await this.updateConfig(
            control,
            state,
            (soFar) => ({threadId: threadId})
        );
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}

export class CreateFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "create" === action;
    }
    create(): ChatWorker {
        return new CreateWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
