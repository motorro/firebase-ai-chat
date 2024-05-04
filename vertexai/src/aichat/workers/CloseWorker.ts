import {ChatCommandData, ChatState, ChatData, DispatchControl, logger} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

export class CloseWorker extends BaseVertexAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "close" === action;
    }

    async doDispatch(
        actions: VertexAiChatActions,
        data: ChatCommandData,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Closing chat...");
        const threadId = state.config.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        await control.updateChatState({
            status: "complete"
        });

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
