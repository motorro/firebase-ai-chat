"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuePostWorker = exports.ExplicitPostWorker = exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiChatAction_1 = require("../data/VertexAiChatAction");
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
const VertexAiChatCommand_1 = require("../data/VertexAiChatCommand");
class BasePostWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instructions, getDispatcherFactory) {
        super(firestore, scheduler, wrapper);
        this.instructions = instructions;
        this.getDispatcherFactory = getDispatcherFactory;
    }
    /**
     * Creates a post dispatch function
     * @param command Command being processed
     * @param dispatcherId Dispatcher ID
     * @returns Tools dispatching function
     * @protected
     */
    getPostDispatch(command, dispatcherId) {
        const dispatcher = this.getDispatcherFactory().getDispatcher(command.commonData.chatDocumentPath, dispatcherId);
        return async (data, toolCalls) => {
            const getContinuationCommand = (continuationRequest) => (Object.assign(Object.assign({}, command), { actionData: ["continuePost", ...command.actionData.slice(1)], continuation: continuationRequest }));
            return await dispatcher.dispatch(data, toolCalls, getContinuationCommand);
        };
    }
    async doDispatch(command, state, control) {
        firebase_ai_chat_core_1.logger.d("Posting messages...");
        const commonData = command.commonData;
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            firebase_ai_chat_core_1.logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Requested instructions not found"));
        }
        const response = await this.doPost(command, threadId, state.config.assistantConfig.instructionsId, instructions, state.data);
        const messageCollectionRef = this.getMessageCollection(commonData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(commonData.chatDocumentPath, commonData.dispatchId);
        const batch = this.db.batch();
        if (response.isResolved()) {
            response.value.messages.forEach((message, index) => {
                batch.set(messageCollectionRef.doc(), {
                    userId: commonData.ownerId,
                    dispatchId: commonData.dispatchId,
                    author: message.author,
                    text: message.text,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: message.createdAt
                });
            });
            await batch.commit();
            await control.updateChatState({
                data: response.value.data
            });
            firebase_ai_chat_core_1.logger.d("Resolved");
            await this.continueNextInQueue(control, command);
        }
        else {
            firebase_ai_chat_core_1.logger.d("Suspended");
        }
    }
}
class PostWorker extends BasePostWorker {
    static isSupportedAction(action) {
        return "post" === action;
    }
    async doPost(command, threadId, dispatcherId, instructions, soFar) {
        return await this.wrapper.postMessage(threadId, instructions, (await this.getMessages(command.commonData.chatDocumentPath, command.commonData.dispatchId)).map((it) => it.text), soFar, this.getPostDispatch(command, dispatcherId));
    }
}
exports.PostWorker = PostWorker;
class ExplicitPostWorker extends BasePostWorker {
    static isSupportedAction(action) {
        return (0, VertexAiChatAction_1.isPostExplicitAction)(action);
    }
    async doPost(command, threadId, dispatcherId, instructions, soFar) {
        return await this.wrapper.postMessage(threadId, instructions, (0, VertexAiChatAction_1.isPostExplicitAction)(command.actionData[0]) ? (command.actionData[0].messages || []) : [], soFar, this.getPostDispatch(command, dispatcherId));
    }
}
exports.ExplicitPostWorker = ExplicitPostWorker;
class ContinuePostWorker extends BasePostWorker {
    static isSupportedCommand(command) {
        return (0, VertexAiChatCommand_1.isVertexAiContinuationCommand)(command);
    }
    async doPost(command, threadId, dispatcherId, instructions) {
        const dispatcher = this.getDispatcherFactory().getDispatcher(command.commonData.chatDocumentPath, dispatcherId);
        const dc = await dispatcher.dispatchCommand(command, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest })));
        if (dc.isResolved()) {
            const dispatch = async (data, toolCalls) => {
                return await dispatcher.dispatch(data, toolCalls, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest })));
            };
            return await this.wrapper.processToolsResponse(threadId, instructions, {
                toolsResult: dc.value.responses
            }, dc.value.data, dispatch);
        }
        return firebase_ai_chat_core_1.Continuation.suspend();
    }
}
exports.ContinuePostWorker = ContinuePostWorker;
//# sourceMappingURL=PostWorker.js.map