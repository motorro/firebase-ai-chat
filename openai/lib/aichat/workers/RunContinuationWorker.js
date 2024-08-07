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
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory, cleaner, logData) {
        super(firestore, scheduler, wrapper, cleaner, logData);
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
        const dc = await dispatcher.dispatchCommand(state.data, command, async (data) => {
            (await control.safeUpdate(async (_tx, updateChatState) => updateChatState({ data: data })));
            return data;
        }, {
            getContinuationCommand: (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest }))
        });
        if (dc.isResolved()) {
            let handOver = dc.value.handOver;
            const dispatch = async (data, toolCalls, runId) => {
                const result = await dispatcher.dispatch({
                    data: data,
                    handOver: handOver
                }, toolCalls, async (data) => {
                    (await control.safeUpdate(async (_tx, updateChatState) => updateChatState({ data: data })));
                    return data;
                }, {
                    getContinuationCommand: (continuationRequest) => (Object.assign(Object.assign({}, command), { continuation: continuationRequest, meta: {
                            runId: runId
                        } }))
                });
                if (result.isResolved()) {
                    handOver = result.value.handOver;
                }
                return result;
            };
            const rc = await this.wrapper.processToolsResponse(threadId, state.config.assistantConfig.assistantId, dc.value.data, dispatch, {
                runId: command.meta.runId,
                toolsResult: dc.value.responses
            });
            if (rc.isResolved()) {
                await control.safeUpdate(async (_tx, updateChatState) => updateChatState({
                    data: rc.value
                }));
                if (null !== handOver) {
                    logger.d("Hand-over by tools: ", JSON.stringify(handOver));
                    await control.continueQueue(Object.assign(Object.assign({}, command), { actionData: ["retrieve", handOver] }));
                }
                else {
                    await this.continueNextInQueue(control, command);
                }
            }
        }
    }
}
exports.RunContinuationWorker = RunContinuationWorker;
//# sourceMappingURL=RunContinuationWorker.js.map