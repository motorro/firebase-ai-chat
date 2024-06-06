import {ChatData, ChatState, DispatchControl, tagLogger} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiQueueWorker} from "./VertexAiQueueWorker";
import {VertexAiChatCommand} from "../data/VertexAiChatCommand";

const logger = tagLogger("CloseWorker");

export class CloseWorker extends VertexAiQueueWorker {
    static isSupportedAction(action: unknown): action is "close" {
        return "close" === action;
    }

    async doDispatch(
        command: VertexAiChatCommand,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Closing chat...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined !== threadId) {
            await this.wrapper.deleteThread(threadId);
        }
        await control.updateChatState({
            status: "complete"
        });

        await this.continueNextInQueue(control, command);
    }
}
