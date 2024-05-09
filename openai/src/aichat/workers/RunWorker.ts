import {ChatCommandData, ChatState, ChatData, DispatchControl, logger, ChatError} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";

export class RunWorker extends BaseOpenAiWorker {
    isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "run" === action;
    }

    async doDispatch(
        actions: OpenAiChatActions,
        _data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const newData = await this.wrapper.run(
            threadId,
            state.config.assistantConfig.assistantId,
            state.data,
            state.config.assistantConfig.dispatcherId
        );

        await control.updateChatState({
            data: newData
        });

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
