import {ChatData, ChatState, DispatchControl, tagLogger} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiQueueWorker} from "./VertexAiQueueWorker";
import {VertexAiChatCommand} from "../data/VertexAiChatCommand";

const logger = tagLogger("CreateWorker");

export class CreateWorker extends VertexAiQueueWorker {
    static isSupportedAction(action: unknown): action is "create" {
        return "create" === action;
    }

    async doDispatch(
        command: VertexAiChatCommand,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        if (state.config.assistantConfig.threadId) {
            logger.d("Already has a thread:", state.config.assistantConfig.threadId);
        } else {
            logger.d("Creating thread...");
            const threadId = await this.wrapper.createThread({
                chat: command.commonData.chatDocumentPath
            });
            logger.d("Thread created:", threadId);
            await this.updateConfig(
                control,
                state,
                () => ({threadId: threadId})
            );
        }
        await this.continueNextInQueue(control, command);
    }
}
