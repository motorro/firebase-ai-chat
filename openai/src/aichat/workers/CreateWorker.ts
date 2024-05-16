import {
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
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

class CreateWorker extends OpenAiQueueWorker {
    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Creating thread...");
        const threadId = await this.wrapper.createThread({
            chat: command.commonData.chatDocumentPath
        });
        await this.updateConfig(
            control,
            state,
            () => ({threadId: threadId})
        );
        await this.continueNextInQueue(control, command);
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
