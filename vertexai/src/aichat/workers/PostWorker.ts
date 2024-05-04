import {ChatCommandData, ChatState, ChatData, DispatchControl, logger, ChatError} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

export class PostWorker extends BaseVertexAiWorker {
    protected isSupportedAction(action: string): boolean {
        return "post" === action;
    }

    async doDispatch(
        actions: VertexAiChatActions,
        data: ChatCommandData,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Posting messages...");
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new ChatError("internal", true, "Requested instructions not found"));
        }

        const messages = await this.getMessages(data.chatDocumentPath, data.dispatchId);
        const response = await this.wrapper.postMessage(
            threadId,
            instructions,
            messages.map((it) => it.text),
            state.data
        );

        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);
        let latestMessageId: string | undefined = undefined;
        const batch = this.db.batch();
        response.messages.forEach((message, index) => {
            batch.set(
                messageCollectionRef.doc(),
                {
                    userId: data.ownerId,
                    dispatchId: data.dispatchId,
                    author: message.author,
                    text: message.text,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: message.createdAt
                }
            );
            latestMessageId = message.id;
        });
        await batch.commit();
        await control.updateChatState({
            ...(undefined != latestMessageId ? {lastMessageId: latestMessageId} : {}),
            data: response.data
        });

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}
