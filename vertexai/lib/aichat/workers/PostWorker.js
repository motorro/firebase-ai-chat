"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuePostWorker = exports.ExplicitPostWorker = exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiChatAction_1 = require("../data/VertexAiChatAction");
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
const VertexAiChatCommand_1 = require("../data/VertexAiChatCommand");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("BasePostWorker");
class BasePostWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     * @param logData Logs chat data if true
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instructions, getDispatcherFactory, logData) {
        super(firestore, scheduler, wrapper, logData);
        this.instructions = instructions;
        this.getDispatcherFactory = getDispatcherFactory;
    }
    /**
     * Creates a post dispatch function
     * @param command Command being processed
     * @param dispatcherId Dispatcher ID
     * @param updateData Updates chat data
     * @returns Tools dispatching function
     * @protected
     */
    getPostDispatch(command, dispatcherId, updateData) {
        const dispatcher = this.getDispatcherFactory().getDispatcher(command.commonData.chatDocumentPath, dispatcherId);
        return async (data, toolCalls) => {
            const getContinuationCommand = (continuationRequest) => (Object.assign(Object.assign({}, command), { actionData: ["continuePost", ...command.actionData.slice(1)], continuation: continuationRequest }));
            return await dispatcher.dispatch(data, toolCalls, updateData, getContinuationCommand);
        };
    }
    async doDispatch(command, state, control) {
        logger.d("Posting messages...");
        const commonData = command.commonData;
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Requested instructions not found"));
        }
        const response = await this.doPost(command, threadId, state.config.assistantConfig.instructionsId, instructions, state.data, async (data) => {
            return control.updateChatState({
                data: data
            });
        });
        const messageCollectionRef = this.getMessageCollection(commonData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(commonData.chatDocumentPath, commonData.dispatchId);
        const batch = this.db.batch();
        if (response.isResolved()) {
            response.value.messages.forEach((message, index) => {
                var _a;
                batch.set(messageCollectionRef.doc(), Object.assign({ userId: commonData.ownerId, dispatchId: commonData.dispatchId, author: message.author, text: message.text, inBatchSortIndex: latestInBatchId + index, createdAt: message.createdAt }, (((_a = state.meta) === null || _a === void 0 ? void 0 : _a.aiMessageMeta) ? { meta: state.meta.aiMessageMeta } : {})));
            });
            await batch.commit();
            await control.updateChatState({
                data: response.value.data
            });
            logger.d("Resolved");
            await this.continueNextInQueue(control, command);
        }
        else {
            logger.d("Suspended");
        }
    }
}
class PostWorker extends BasePostWorker {
    static isSupportedAction(action) {
        return "post" === action;
    }
    async doPost(command, threadId, dispatcherId, instructions, soFar, updateStateData) {
        return await this.wrapper.postMessage(threadId, instructions, (await this.getMessages(command.commonData.chatDocumentPath, command.commonData.dispatchId)).map((it) => it.text), soFar, this.getPostDispatch(command, dispatcherId, updateStateData));
    }
}
exports.PostWorker = PostWorker;
class ExplicitPostWorker extends BasePostWorker {
    static isSupportedAction(action) {
        return (0, VertexAiChatAction_1.isPostExplicitAction)(action);
    }
    async doPost(command, threadId, dispatcherId, instructions, soFar, updateStateData) {
        return await this.wrapper.postMessage(threadId, instructions, (0, VertexAiChatAction_1.isPostExplicitAction)(command.actionData[0]) ? (command.actionData[0].messages || []) : [], soFar, this.getPostDispatch(command, dispatcherId, updateStateData));
    }
}
exports.ExplicitPostWorker = ExplicitPostWorker;
class ContinuePostWorker extends BasePostWorker {
    static isSupportedCommand(command) {
        return (0, VertexAiChatCommand_1.isVertexAiContinuationCommand)(command);
    }
    async doPost(command, threadId, dispatcherId, instructions, soFar, updateStateData) {
        const dispatcher = this.getDispatcherFactory().getDispatcher(command.commonData.chatDocumentPath, dispatcherId);
        const dc = await dispatcher.dispatchCommand(soFar, command, updateStateData, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest })));
        if (dc.isResolved()) {
            const dispatch = async (data, toolCalls) => {
                return await dispatcher.dispatch(data, toolCalls, updateStateData, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest })));
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