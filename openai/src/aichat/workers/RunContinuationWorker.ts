import {
    ChatCommand,
    ChatData,
    ChatError,
    ChatState,
    ChatWorker, Continuation,
    ContinuationRequest,
    DispatchControl,
    logger,
    TaskScheduler, ToolCallRequest, ToolCallsResult,
    ToolContinuationFactory
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatActions} from "../data/OpenAiChatAction";
import {AiWrapper} from "../AiWrapper";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {isOpenAiContinuationCommand, OpenAiContinuationCommand} from "../data/OpenAiChatCommand";

class RunContinuationWorker extends OpenAiQueueWorker {
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
        command: OpenAiContinuationCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Running continuation...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at continuation running");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at continuation running"));
        }

        const dispatcher = this.toolsDispatchFactory.getDispatcher<OpenAiChatActions, OpenAiContinuationCommand, ChatData>(
            command.commonData.chatDocumentPath,
            state.config.assistantConfig.dispatcherId
        );

        const dc = await dispatcher.dispatchCommand(
            command,
            (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                // Already a continuation command so if suspended we use the same set of actions
                // Alter continuation data and meta
                ...command,
                continuation: continuationRequest
            })
        );

        if (dc.isResolved()) {
            const dispatch = async (
                data: ChatData,
                toolCalls: ReadonlyArray<ToolCallRequest>,
                runId: string
            ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
                return await dispatcher.dispatch(
                    data,
                    toolCalls,
                    (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                        // Already a continuation command so if suspended we use the same set of actions
                        // Alter continuation data and meta
                        ...command,
                        continuation: continuationRequest,
                        meta: {
                            runId: runId
                        }
                    })
                );
            };

            const rc = await this.wrapper.processToolsResponse(
                threadId,
                state.config.assistantConfig.assistantId,
                dc.value.data,
                dispatch,
                {
                    runId: command.meta.runId,
                    toolsResult: dc.value.responses
                }
            );

            if (rc.isResolved()) {
                await control.updateChatState({
                    data: rc.value
                });
                await this.continueNextInQueue(control, command);
            }
        }
    }
}

export class RunContinuationFactory extends WorkerFactory {
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

    /**
     * Checks if command is supported
     * @param command Command to check
     * @return True if command is supported
     */
    isSupportedCommand(command: ChatCommand<unknown>): boolean {
        return isOpenAiContinuationCommand(command);
    }
    create(): ChatWorker {
        return new RunContinuationWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
    }
}
