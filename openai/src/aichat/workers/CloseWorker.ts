import {ChatCommandData, ChatState, ChatData, DispatchControl, logger, ChatWorker} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {WorkerFactory} from "./WorkerFactory";

class CloseWorker extends OpenAiQueueWorker {
    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Closing chat...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        await control.updateChatState({
            status: "complete"
        });

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}

export class CloseFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "close" === action;
    }
    create(): ChatWorker {
        return new CloseWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
