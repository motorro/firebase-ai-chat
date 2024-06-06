"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunContinuationWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const OpenAiChatCommand_1 = require("../data/OpenAiChatCommand");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("RunContinuationWorker");
class RunContinuationWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedCommand(command) {
        return (0, OpenAiChatCommand_1.isOpenAiContinuationCommand)(command);
    }
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory) {
        super(firestore, scheduler, wrapper);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }
    async doDispatch(command, state, control) {
        logger.d("Running continuation...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at continuation running");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at continuation running"));
        }
        const dispatcher = this.toolsDispatchFactory.getDispatcher(command.commonData.chatDocumentPath, state.config.assistantConfig.dispatcherId);
        const dc = await dispatcher.dispatchCommand(command, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest })));
        if (dc.isResolved()) {
            const dispatch = async (data, toolCalls, runId) => {
                return await dispatcher.dispatch(data, toolCalls, (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest, meta: {
                        runId: runId
                    } })));
            };
            const rc = await this.wrapper.processToolsResponse(threadId, state.config.assistantConfig.assistantId, dc.value.data, dispatch, {
                runId: command.meta.runId,
                toolsResult: dc.value.responses
            });
            if (rc.isResolved()) {
                await control.updateChatState({
                    data: rc.value
                });
                await this.continueNextInQueue(control, command);
            }
        }
    }
}
exports.RunContinuationWorker = RunContinuationWorker;
//# sourceMappingURL=RunContinuationWorker.js.map