import {ChatCommandData, ChatState, ChatData, DispatchControl, logger, ChatError} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {isPostExplicitAction, VertexAiChatAction, VertexAiChatActions} from "../data/VertexAiChatAction";
import {BaseVertexAiWorker} from "./BaseVertexAiWorker";

abstract class BasePostWorker extends BaseVertexAiWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction {
        return "post" === action || isPostExplicitAction(action);
    }

    /**
     * Retrieves messages
     * @param data Command data
     * @param action Processed action
     * @protected
     */
    protected abstract doGetMessages(data: ChatCommandData, action: VertexAiChatAction): Promise<ReadonlyArray<string>>;

    async doDispatch(
        actions: VertexAiChatActions,
        data: ChatCommandData,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Posting messages...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new ChatError("internal", true, "Requested instructions not found"));
        }

        const response = await this.wrapper.postMessage(
            threadId,
            instructions,
            (await this.doGetMessages(data, actions[0])),
            state.data
        );

        const messageCollectionRef = this.getMessageCollection(data.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(data.chatDocumentPath, data.dispatchId);
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
        });
        await batch.commit();
        await control.updateChatState({
            data: response.data
        });

        await this.continueQueue(control, actions.slice(1, actions.length));
    }
}

export class PostWorker extends BasePostWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction {
        return "post" === action;
    }

    protected async doGetMessages(data: ChatCommandData): Promise<ReadonlyArray<string>> {
        return (await this.getMessages(data.chatDocumentPath, data.dispatchId)).map((it) => it.text);
    }
}

export class ExplicitPostWorker extends BasePostWorker {
    isSupportedAction(action: unknown): action is VertexAiChatAction {
        return isPostExplicitAction(action);
    }

    protected async doGetMessages(_data: ChatCommandData, action: VertexAiChatAction): Promise<ReadonlyArray<string>> {
        return isPostExplicitAction(action) ? (action.messages || []) : [];
    }
}


