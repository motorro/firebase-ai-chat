"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunWorker = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
const logger = (0, firebase_ai_chat_core_1.tagLogger)("RunWorker");
class RunWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "run" === action;
    }
    constructor(firestore, scheduler, wrapper, chatCleaner, toolsDispatchFactory, logData) {
        super(firestore, scheduler, wrapper, chatCleaner, logData);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }
    async doDispatch(command, state, control) {
        logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at running");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at running"));
        }
        const dispatcher = this.toolsDispatchFactory.getDispatcher(command.commonData.chatDocumentPath, state.config.assistantConfig.dispatcherId);
        let handOver = null;
        const dispatch = async (data, toolCalls, runId) => {
            const getContinuationCommand = (continuationRequest) => (Object.assign(Object.assign({}, command), { actionData: ["continueRun", ...command.actionData.slice(1)], continuation: continuationRequest, meta: {
                    runId: runId
                } }));
            const result = await dispatcher.dispatch(data, toolCalls, async (data) => {
                await control.safeUpdate(async (_tx, updateChatState) => updateChatState({ data: data }));
                return data;
            }, {
                getContinuationCommand: getContinuationCommand
            });
            if (result.isResolved()) {
                handOver = result.value.handOver;
            }
            return result;
        };
        const continuation = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatch);
        if (continuation.isResolved()) {
            await control.safeUpdate(async (_tx, updateChatState) => {
                updateChatState({ data: continuation.value });
            });
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
exports.RunWorker = RunWorker;
//# sourceMappingURL=RunWorker.js.map