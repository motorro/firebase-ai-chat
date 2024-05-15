import {
    ChatCommandData,
    ChatState,
    ChatData,
    DispatchControl,
    logger,
    ChatError,
    TaskScheduler, ToolContinuationFactory, ChatWorker
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {AiWrapper} from "../AiWrapper";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {engineId} from "../../engineId";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

class RunWorker extends OpenAiQueueWorker {

    private readonly toolsDispatchFactory: ToolContinuationFactory;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationFactory
    ) {
        super(firestore, scheduler, wrapper);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }

    async doDispatch(
        actions: OpenAiChatActions,
        data: ChatCommandData,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }

        const continuation = await this.wrapper.run(
            threadId,
            state.config.assistantConfig.assistantId,
            state.data,
            await this.toolsDispatchFactory.getDispatcher(data, state.config.assistantConfig.dispatcherId),
            (runId) => ({
                engine: engineId,
                runId: runId,
                next: <OpenAiChatCommand>control.getContinuation(actions.slice(1, actions.length))
            })
        );

        if (continuation.isResolved()) {
            await control.updateChatState({
                data: continuation.value
            });
            await this.continueQueue(control, actions.slice(1, actions.length));
        }
    }
}

export class RunFactory extends WorkerFactory {
    private readonly toolsDispatchFactory: ToolContinuationFactory;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param toolsDispatchFactory Tool dispatcher factory
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationFactory
    ) {
        super(firestore, scheduler, wrapper);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }

    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "run" === action;
    }
    create(): ChatWorker {
        return new RunWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
    }
}
