import {
    ChatCommand,
    ChatData,
    ChatError,
    ChatState,
    Continuation,
    ContinuationRequest,
    DispatchControl,
    logger,
    TaskScheduler,
    ToolCallRequest,
    ToolCallsResult,
    ToolContinuationFactory
} from "@motorro/firebase-ai-chat-core";
import {VertexAiAssistantConfig} from "../data/VertexAiAssistantConfig";
import {isPostExplicitAction, PostExplicit, VertexAiChatActions} from "../data/VertexAiChatAction";
import {VertexAiQueueWorker} from "./VertexAiQueueWorker";
import {VertexAiSystemInstructions} from "../data/VertexAiSystemInstructions";
import {AiWrapper, PostMessageResult} from "../AiWrapper";
import {
    isVertexAiContinuationCommand,
    VertexAiChatCommand,
    VertexAiContinuationCommand
} from "../data/VertexAiChatCommand";

abstract class BasePostWorker extends VertexAiQueueWorker {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>;
    protected readonly getDispatcherFactory: () => ToolContinuationFactory;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>,
        getDispatcherFactory: () => ToolContinuationFactory
    ) {
        super(firestore, scheduler, wrapper);
        this.instructions = instructions;
        this.getDispatcherFactory = getDispatcherFactory;
    }

    /**
     * Runs post action
     * @param command Command being processed
     * @param threadId Thread ID
     * @param dispatcherId Dispatcher ID
     * @param instructions AI instructions
     * @param soFar Data so far
     * @returns Continuation for post message result
     * @protected
     */
    protected abstract doPost(
        command: VertexAiChatCommand,
        threadId: string,
        dispatcherId: string,
        instructions: VertexAiSystemInstructions<ChatData>,
        soFar: ChatData
    ): Promise<Continuation<PostMessageResult<ChatData>>>;

    /**
     * Creates a post dispatch function
     * @param command Command being processed
     * @param dispatcherId Dispatcher ID
     * @returns Tools dispatching function
     * @protected
     */
    protected getPostDispatch(
        command: VertexAiChatCommand,
        dispatcherId: string
    ): (data: ChatData, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<ChatData>>> {
        const dispatcher = this.getDispatcherFactory().getDispatcher<VertexAiChatActions, VertexAiContinuationCommand, ChatData>(
            command.commonData.chatDocumentPath,
            dispatcherId
        );

        return async (
            data: ChatData,
            toolCalls: ReadonlyArray<ToolCallRequest>
        ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
            const getContinuationCommand = (continuationRequest: ContinuationRequest): VertexAiContinuationCommand => ({
                // Shift following actions and add continuation run
                ...command,
                actionData: ["continuePost", ...command.actionData],
                continuation: continuationRequest
            });

            return await dispatcher.dispatch(
                data,
                toolCalls,
                getContinuationCommand
            );
        };
    }

    async doDispatch(
        command: VertexAiChatCommand,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>
    ): Promise<void> {
        logger.d("Posting messages...");
        const commonData = command.commonData;
        const threadId = state.config.assistantConfig.threadId;
        if (undefined === threadId) {
            logger.e("Thread ID is not defined at message posting");
            return Promise.reject(new ChatError("internal", true, "Thread ID is not defined at message posting"));
        }
        const instructions = this.instructions[state.config.assistantConfig.instructionsId];
        if (undefined === instructions) {
            logger.e("Requested instructions are not found:", state.config.assistantConfig.instructionsId);
            return Promise.reject(new ChatError("internal", true, "Requested instructions not found"));
        }

        const response = await this.doPost(
            command,
            threadId,
            state.config.assistantConfig.instructionsId,
            instructions,
            state.data
        );

        const messageCollectionRef = this.getMessageCollection(commonData.chatDocumentPath);
        const latestInBatchId = await this.getNextBatchSortIndex(commonData.chatDocumentPath, commonData.dispatchId);
        const batch = this.db.batch();

        if (response.isResolved()) {
            response.value.messages.forEach((message, index) => {
                batch.set(
                    messageCollectionRef.doc(),
                    {
                        userId: commonData.ownerId,
                        dispatchId: commonData.dispatchId,
                        author: message.author,
                        text: message.text,
                        inBatchSortIndex: latestInBatchId + index,
                        createdAt: message.createdAt
                    }
                );
            });
            await batch.commit();
            await control.updateChatState({
                data: response.value.data
            });
            logger.d("Resolved");
            await this.continueNextInQueue(control, command);
        } else {
            logger.d("Suspended");
        }
    }
}

export class PostWorker extends BasePostWorker {
    static isSupportedAction(action: unknown): action is "post" {
        return "post" === action;
    }

    protected async doPost(
        command: VertexAiChatCommand,
        threadId: string,
        dispatcherId: string,
        instructions: VertexAiSystemInstructions<ChatData>,
        soFar: ChatData
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        return await this.wrapper.postMessage(
            threadId,
            instructions,
            (await this.getMessages(command.commonData.chatDocumentPath, command.commonData.dispatchId)).map((it) => it.text),
            soFar,
            this.getPostDispatch(command, dispatcherId)
        );
    }
}

export class ExplicitPostWorker extends BasePostWorker {
    static isSupportedAction(action: unknown): action is PostExplicit {
        return isPostExplicitAction(action);
    }

    protected async doPost(
        command: VertexAiChatCommand,
        threadId: string,
        dispatcherId: string,
        instructions: VertexAiSystemInstructions<ChatData>,
        soFar: ChatData,
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        return await this.wrapper.postMessage(
            threadId,
            instructions,
            isPostExplicitAction(command.actionData[0]) ? (command.actionData[0].messages || []) : [],
            soFar,
            this.getPostDispatch(command, dispatcherId)
        );
    }
}

export class ContinuePostWorker extends BasePostWorker {
    static isSupportedCommand(command: ChatCommand<unknown>): command is VertexAiContinuationCommand {
        return isVertexAiContinuationCommand(command);
    }

    protected async doPost(
        command: VertexAiContinuationCommand,
        threadId: string,
        dispatcherId: string,
        instructions: VertexAiSystemInstructions<ChatData>
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        const dispatcher = this.getDispatcherFactory().getDispatcher<VertexAiChatActions, VertexAiContinuationCommand, ChatData>(
            command.commonData.chatDocumentPath,
            dispatcherId
        );

        const dc = await dispatcher.dispatchCommand(
            command,
            (continuationRequest: ContinuationRequest): VertexAiContinuationCommand => ({
                // Already a continuation command so if suspended we use the same set of actions
                // Alter continuation data and meta
                ...command,
                continuation: continuationRequest
            })
        );

        if (dc.isResolved()) {
            const dispatch = async (
                data: ChatData,
                toolCalls: ReadonlyArray<ToolCallRequest>
            ): Promise<Continuation<ToolCallsResult<ChatData>>> => {
                return await dispatcher.dispatch(
                    data,
                    toolCalls,
                    (continuationRequest: ContinuationRequest): VertexAiContinuationCommand => ({
                        // Already a continuation command so if suspended we use the same set of actions
                        // Alter continuation data and meta
                        ...command,
                        continuation: continuationRequest
                    })
                );
            };

            return await this.wrapper.processToolsResponse(
                threadId,
                instructions,
                {
                    toolsResult: dc.value.responses
                },
                dc.value.data,
                dispatch
            );
        }

        return Continuation.suspend();
    }
}
