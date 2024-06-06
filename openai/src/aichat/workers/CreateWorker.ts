import {
    ChatState,
    ChatData,
    DispatchControl,
    tagLogger
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("CreateWorker");

export class CreateWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "create" === action;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
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
