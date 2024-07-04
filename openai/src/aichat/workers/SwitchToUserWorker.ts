import {ChatData, ChatState, DispatchControl} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

export class SwitchToUserWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "switchToUserInput" === action;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        _state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        await this.continueQueue(control, command);
    }
}
