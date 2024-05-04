import {ChatCommandData, ChatState, ChatData, DispatchControl} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

export class SwitchToUserWorker extends BaseVertexAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "switchToUserInput" === action;
    }

    async doDispatch(
        actions: VertexAiChatActions,
        _data: ChatCommandData,
        _state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        await this.continueQueue(control, actions);
    }
}
