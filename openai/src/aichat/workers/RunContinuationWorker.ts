import {
    ChatCleaner,
    ChatCommand,
    ChatData,
    ChatError,
    ChatState,
    Continuation,
    ContinuationRequest,
    DispatchControl, HandBackAction, HandOverAction,
    tagLogger,
    TaskScheduler, ToolCallRequest, ToolCallsResult,
    ToolContinuationDispatcherFactory
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {AiWrapper} from "../AiWrapper";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {isOpenAiContinuationCommand, OpenAiContinuationCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("RunContinuationWorker");

export class RunContinuationWorker extends OpenAiQueueWorker {
    static isSupportedCommand(command: ChatCommand<unknown>): boolean {
        return isOpenAiContinuationCommand(command);
    }

    private readonly toolsDispatchFactory: ToolContinuationDispatcherFactory;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationDispatcherFactory,
        cleaner: ChatCleaner,
        logData: boolean
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }

    async doDispatch(
        command: OpenAiContinuationCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        logger.d("Running continuation...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at continuation running");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at continuation running"));
        }

        const dispatcher = this.toolsDispatchFactory.getDispatcher<ChatData>(
            command.commonData.chatDocumentPath,
            state.config.assistantConfig.dispatcherId
        );

        const dc = await dispatcher.dispatchCommand(
            state.data,
            command,
            async (data) => {
                (await control.safeUpdate(async (_tx, updateChatState) => updateChatState({data: data})));
                return data;
            },
            {
                getContinuationCommand: (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                    // Already a continuation command so if suspended we use the same set of actions
                    // Alter continuation data and meta
                    ...command,
                    continuation: continuationRequest
                })
            }
        );

        if (dc.isResolved()) {
            let handOver: HandOverAction | HandBackAction | null = dc.value.handOver;

            const dispatch = async (
                data: ChatData,
                toolCalls: ReadonlyArray<ToolCallRequest>,
                runId: string
            ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
                const result = await dispatcher.dispatch(
                    {
                        data: data,
                        handOver: handOver
                    },
                    toolCalls,
                    async (data) => {
                        (await control.safeUpdate(async (_tx, updateChatState) => updateChatState({data: data})));
                        return data;
                    },
                    {
                        getContinuationCommand: (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                            // Already a continuation command so if suspended we use the same set of actions
                            // Alter continuation data and meta
                            ...command,
                            continuation: continuationRequest,
                            meta: {
                                runId: runId
                            }
                        })
                    }
                );
                if (result.isResolved()) {
                    handOver = result.value.handOver;
                }
                return result;
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
                await control.safeUpdate(async (_tx, updateChatState) => updateChatState({
                    data: rc.value
                }));
                if (null !== handOver) {
                    logger.d("Hand-over by tools: ", JSON.stringify(handOver));
                    await control.continueQueue({...command, actionData: ["retrieve", handOver]});
                } else {
                    await this.continueNextInQueue(control, command);
                }
            }
        }
    }
}
