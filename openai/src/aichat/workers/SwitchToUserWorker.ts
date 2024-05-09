import {ChatCommandData, ChatState, ChatData, DispatchControl} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";

export class SwitchToUserWorker extends BaseOpenAiWorker {
    isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "switchToUserInput" === action;
    }

    async doDispatch(
        actions: OpenAiChatActions,
        _data: ChatCommandData,
        _state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        await this.continueQueue(control, actions);
    }
}
