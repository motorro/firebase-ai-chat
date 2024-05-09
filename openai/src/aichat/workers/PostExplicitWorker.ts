import {ChatCommandData, ChatState, ChatData, DispatchControl, logger, ChatError} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {isPostExplicitAction, OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";

export class PostExplicitWorker extends BaseOpenAiWorker {
    isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isPostExplicitAction(action);
    }

    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        const postExplicit = actions[0];
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
                latestMessageId = await this.wrapper.postMessage(threadId, message);
            }

            if (undefined !== latestMessageId) {
                await this.updateConfig(
                    control,
                    state,
                    () => ({lastMessageId: latestMessageId})
                );
            }

            await this.continueQueue(control, actions.slice(1, actions.length));
        } else {
            return Promise.reject(new ChatError("unknown", true, "Expected explicit post action", JSON.stringify(postExplicit)));
        }
    }
}
