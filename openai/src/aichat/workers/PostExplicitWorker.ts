import {
    ChatData,
    ChatError,
    ChatState,
    DispatchControl, isStructuredMessage,
    tagLogger
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {isPostExplicitAction, OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("PostExplicitWorker");

export class PostExplicitWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isPostExplicitAction(action);
    }
    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        const postExplicit = command.actionData[0];
        if (isPostExplicitAction(postExplicit)) {
            logger.d("Posting explicit messages...");
            const threadId = state.config.assistantConfig.threadId;
            if (undefined === threadId) {
                logger.e("Thread ID is not defined at message posting");
                return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
            }

            const messages = postExplicit.messages;
            let latestMessageId: string | undefined = undefined;
            for (const message of messages) {
                const text = isStructuredMessage(message) ? message.text : <string>message
                latestMessageId = await this.wrapper.postMessage(threadId, text);
            }

            if (undefined !== latestMessageId) {
                await this.updateConfig(
                    control,
                    state,
                    () => ({lastMessageId: latestMessageId})
                );
            }

            await this.continueNextInQueue(control, command);
        } else {
            return Promise.reject(new ChatError("unknown", true, "Expected explicit post action", JSON.stringify(postExplicit)));
        }
    }
}

