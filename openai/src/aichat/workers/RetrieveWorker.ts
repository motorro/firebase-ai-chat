import {
    ChatState,
    ChatData,
    DispatchControl,
    ChatError,
    tagLogger, Meta, isStructuredMessage
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {firestore} from "firebase-admin";
import FieldValue = firestore.FieldValue;
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("RetrieveWorker");

export class RetrieveWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "retrieve" === action;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messageCollectionRef = this.getMessageCollection(command.commonData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(command.commonData.chatDocumentPath, command.commonData.dispatchId);

        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach(([id, message], index) => {
            let text: string;
            let data: Readonly<Record<string, unknown>> | null = null;
            let meta: Meta | null = state.meta?.aiMessageMeta || null;
            if (isStructuredMessage(message)) {
                text = message.text;
                data = message.data || null;
                if (message.meta) {
                    if (null != meta) {
                        meta = {...meta, ...message.meta};
                    } else {
                        meta = message.meta;
                    }
                }
            } else {
                text = String(message);
            }
            batch.set(
                messageCollectionRef.doc(),
                {
                    userId: command.commonData.ownerId,
                    dispatchId: command.commonData.dispatchId,
                    author: "ai",
                    text: text,
                    data: data,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp(),
                    meta: meta
                }
            );
        });
        await batch.commit();
        await this.updateConfig(
            control,
            state,
            () => ({lastMessageId: newMessages.latestMessageId})
        );

        await this.continueNextInQueue(control, command);
    }
}
