import {ChatState, ChatData, DispatchControl, logger, ChatError, ChatCommandData} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatActions} from "../data/OpenAiChatAction";
import {BaseOpenAiWorker} from "./BaseOpenAiWorker";
import {firestore} from "firebase-admin";
import FieldValue = firestore.FieldValue;

export class RetrieveWorker extends BaseOpenAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "retrieve" === action;
    }

    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Retrieving messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);

        const newMessages = await this.wrapper.getMessages(threadId, state.config.assistantConfig.lastMessageId);
        const batch = this.db.batch();
        newMessages.messages.forEach((message, index) => {
            batch.set(
                messageCollectionRef.doc(),
                {
                    userId: data.ownerId,
                    dispatchId: data.dispatchId,
                    author: "ai",
                    text: message[1],
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp()
                }
            );
        });
        await batch.commit();
        await this.updateConfig(
            control,
            state,
            (soFar) => ({lastMessageId: newMessages.latestMessageId})
        );

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
