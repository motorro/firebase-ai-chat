import {ChatCommandData, ChatState, ChatData, DispatchControl, logger} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatAction, VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

export class CreateWorker extends BaseVertexAiWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction {
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
        await this.updateConfig(
            control,
            state,
            (soFar) => ({threadId: threadId})
        );
        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
