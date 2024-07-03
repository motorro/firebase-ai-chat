import {
    ChatState,
    ChatData,
    DispatchControl,
    ChatError,
    TaskScheduler,
    ToolContinuationDispatcherFactory,
    ToolCallRequest,
    Continuation,
    ToolCallsResult,
    ContinuationRequest, tagLogger, ChatCleaner, HandOverAction, HandBackAction
} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {AiWrapper} from "../AiWrapper";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand, OpenAiContinuationCommand} from "../data/OpenAiChatCommand";

const logger = tagLogger("RunWorker");

export class RunWorker extends OpenAiQueueWorker {
    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "run" === action;
    }

    private readonly toolsDispatchFactory: ToolContinuationDispatcherFactory;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        chatCleaner: ChatCleaner,
        toolsDispatchFactory: ToolContinuationDispatcherFactory,
        logData: boolean
    ) {
        super(firestore, scheduler, wrapper, chatCleaner, logData);
        this.toolsDispatchFactory = toolsDispatchFactory;
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        logger.d("Running assistant...");
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at running");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at running"));
        }

        const dispatcher = this.toolsDispatchFactory.getDispatcher<ChatData>(
            command.commonData.chatDocumentPath,
            state.config.assistantConfig.dispatcherId
        );

        let handOver: HandOverAction | HandBackAction | null = null;

        const dispatch = async (
            data: ChatData,
            toolCalls: ReadonlyArray<ToolCallRequest>,
            runId: string
        ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
            const getContinuationCommand = (continuationRequest: ContinuationRequest): OpenAiContinuationCommand => ({
                // Shift following actions and add continuation run
                ...command,
                actionData: ["continueRun", ...command.actionData.slice(1)],
                continuation: continuationRequest,
                meta: {
                    runId: runId
                }
            });

            const result = await dispatcher.dispatch(
                data,
                toolCalls,
                async (data) => {
                    await control.safeUpdate(async (_tx, updateChatState) => updateChatState({data: data}));
                    return data;
                },
                {
                    getContinuationCommand: getContinuationCommand
                }
            );
            if (result.isResolved()) {
                handOver = result.value.handOver;
            }
            return result;
        };

        const continuation = await this.wrapper.run(
            threadId,
            state.config.assistantConfig.assistantId,
            state.data,
            dispatch
        );

        if (continuation.isResolved()) {
            await control.safeUpdate(async (_tx, updateChatState) => {
                updateChatState({data: continuation.value});
            });
            if (null !== handOver) {
                logger.d("Hand-over by tools: ", JSON.stringify(handOver));
                await control.continueQueue({...command, actionData: ["retrieve", handOver]});
            } else {
                await this.continueNextInQueue(control, command);
            }
        }
    }
}
