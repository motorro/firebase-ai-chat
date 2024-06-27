"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContinuePostWorker = exports.ExplicitPostWorker = exports.PostWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiChatAction_1 = require("../data/VertexAiChatAction");
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
const VertexAiChatCommand_1 = require("../data/VertexAiChatCommand");
const mock_1 = require("../../../test/mock");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("BasePostWorker");
class BasePostWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     * @param cleaner Chat cleaner
     * @param logData Logs chat data if true
     * @param messageMiddleware Optional Message processing middleware
     */
    constructor(firestore, scheduler, wrapper, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instructions, getDispatcherFactory, cleaner, logData, messageMiddleware) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.instructions = instructions;
        this.getDispatcherFactory = getDispatcherFactory;
        this.messageMiddleware = messageMiddleware;
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
            await control.safeUpdate(async (_tx, updateChatState) => updateChatState({ data: data }));
            return data;
        });
        if (response.isResolved()) {
            logger.d("Resolved");
            const newData = response.value.data;
            await control.safeUpdate(async (_tx, updateChatState) => {
                updateChatState({ data: newData });
            });
            await this.processMessages(command, Object.assign(Object.assign({}, mock_1.chatState), { data: newData }), async (messages, _document, _state, mpc) => {
                await mpc.safeUpdate(async (_tx, _updateState, saveMessages) => {
                    saveMessages(messages);
                });
                await this.continueNextInQueue(control, command);
            }, control, this.messageMiddleware, response.value.messages);
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