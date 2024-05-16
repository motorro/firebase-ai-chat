import {
    ChatState,
    ChatData,
    DispatchControl,
    logger,
    ChatError,
    TaskScheduler,
    ToolContinuationFactory,
    ChatWorker,
    ToolCallRequest,
    Continuation,
    ToolCallsResult,
    ContinuationRequest
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {AiWrapper} from "../AiWrapper";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand, OpenAiContinuationCommand} from "../data/OpenAiChatCommand";

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
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at running");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at running"));
        }

        const dispatcher = this.toolsDispatchFactory.getDispatcher<OpenAiChatActions, OpenAiContinuationCommand, ChatData>(
            command.commonData.chatDocumentPath,
            state.config.assistantConfig.dispatcherId
        );

        const dispatch = async (
            data: ChatData,
            toolCalls: ReadonlyArray<ToolCallRequest>,
            runId: string
        ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
            const getContinuationCommand = (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                // Shift following actions and add continuation run
                ...command,
                actionData: ["continueRun", ...command.actionData],
                continuation: continuationRequest,
                meta: {
                    runId: runId
                }
            });

            return await dispatcher.dispatch(
                data,
                toolCalls,
                getContinuationCommand
            );
        };

        const continuation = await this.wrapper.run(
            threadId,
            state.config.assistantConfig.assistantId,
            state.data,
            dispatch
        );

        if (continuation.isResolved()) {
            await control.updateChatState({
                data: continuation.value
            });
            await this.continueNextInQueue(control, command);
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
