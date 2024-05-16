"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunFactory = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const WorkerFactory_1 = require("./WorkerFactory");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class RunWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory) {
        super(firestore, scheduler, wrapper);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }
    async doDispatch(command, state, control) {
        firebase_ai_chat_core_1.logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            firebase_ai_chat_core_1.logger.e("Thread ID is not defined at running");
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("internal", true, "Thread ID is not defined at running"));
        }
        const dispatcher = this.toolsDispatchFactory.getDispatcher(command.commonData.chatDocumentPath, state.config.assistantConfig.dispatcherId);
        const dispatch = async (data, toolCalls, runId) => {
            const getContinuationCommand = (continuationRequest) => (Object.assign(Object.assign({}, command), { actionData: ["continueRun", ...command.actionData], continuation: continuationRequest, meta: {
                    runId: runId
                } }));
            return await dispatcher.dispatch(data, toolCalls, getContinuationCommand);
        };
        const continuation = await this.wrapper.run(threadId, state.config.assistantConfig.assistantId, state.data, dispatch);
        if (continuation.isResolved()) {
            await control.updateChatState({
                data: continuation.value
            });
            await this.continueNextInQueue(control, command);
        }
    }
}
class RunFactory extends WorkerFactory_1.WorkerFactory {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param toolsDispatchFactory Tool dispatcher factory
     */
    constructor(firestore, scheduler, wrapper, toolsDispatchFactory) {
        super(firestore, scheduler, wrapper);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }
    isSupportedAction(action) {
        return "run" === action;
    }
    create() {
        return new RunWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
    }
}
exports.RunFactory = RunFactory;
//# sourceMappingURL=RunWorker.js.map