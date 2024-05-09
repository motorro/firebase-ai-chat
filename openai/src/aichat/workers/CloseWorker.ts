import {ChatCommandData, ChatState, ChatData, DispatchControl, logger} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";

export class CloseWorker extends BaseOpenAiWorker {
    isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "close" === action;
    }

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
