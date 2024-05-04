import {ChatCommandData, ChatState, ChatData, DispatchControl, logger} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

export class CreateWorker extends BaseVertexAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "create" === action;
    }

    async doDispatch(
        actions: VertexAiChatActions,
        data: ChatCommandData,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
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
