import {WorkerFactory} from "./WorkerFactory";
import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {
    ChatCommand,
    ChatCommandData,
    ChatData,
    ChatState,
    ChatWorker, ContinuationRequest,
    DispatchControl,
    isContinuationCommand, logger,
    TaskScheduler, ToolCallsResult,
    ToolContinuationFactory
} from "@motorro/firebase-ai-chat-core";
import {isRunContinuationMeta, RunContinuationMeta} from "../data/RunResponse";
import {AiWrapper} from "../AiWrapper";
import {BaseWorker} from "./OpenAiQueueWorker";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {engineId} from "../../engineId";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

export class ContinuationFactory extends WorkerFactory {
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
        return isContinuationCommand((command), isRunContinuationMeta);
    }

    async create(queueName: string): ChatWorker {
        return this.toolsDispatchFactory.getWorker(
            isRunContinuationMeta,
            async (
                data: ChatCommandData,
                result: ToolCallsResult<ChatData, RunContinuationMeta>,
                updateChatState: (state: Partial<ChatState<OpenAiAssistantConfig, ChatData>>) => Promise<boolean>
            ) => {
                const meta = result.meta;
                const continuation = await this.wrapper.processToolsResponse(
                    meta.config.threadId!,
                    meta.config.assistantId,
                    result.data,
                    await this.toolsDispatchFactory.getDispatcher(data, meta.config.dispatcherId),
                    (runId) => ({...meta, runId: runId}),
                    {
                        runId: meta.runId,
                        toolsResult: result.responses
                    }
                );
                if (continuation.isResolved()) {
                    await updateChatState({
                        data: continuation.value
                    });
                    await this.continueQueue(control, actions.slice(1, actions.length));
                }

            }
        );
    }
}
