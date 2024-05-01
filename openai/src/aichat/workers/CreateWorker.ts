import {ChatCommandData, ChatState, ChatData, DispatchControl, logger} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";

export class CreateWorker extends BaseOpenAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "create" === action;
    }

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
        await control.updateChatState({
            config: {
                ...state.config,
                threadId: threadId
            }
        });
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
