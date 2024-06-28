import {
    ChatCleaner,
    ChatCommand,
    ChatData,
    ChatError,
    ChatState,
    Continuation,
    ContinuationRequest,
    DispatchControl,
    MessageMiddleware,
    tagLogger,
    TaskScheduler,
    ToolCallRequest,
    ToolCallsResult,
    ToolContinuationDispatcherFactory
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

const logger = tagLogger("BasePostWorker");

abstract class BasePostWorker extends VertexAiQueueWorker {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>;
    protected readonly getDispatcherFactory: () => ToolContinuationDispatcherFactory;
    private readonly messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param instructions System instructions
     * @param getDispatcherFactory Tool dispatch factory
     * @param cleaner Chat cleaner
     * @param logData Logs chat data if true
     * @param messageMiddleware Optional Message processing middleware
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>,
        getDispatcherFactory: () => ToolContinuationDispatcherFactory,
        cleaner: ChatCleaner,
        logData: boolean,
        messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.instructions = instructions;
        this.getDispatcherFactory = getDispatcherFactory;
        this.messageMiddleware = messageMiddleware;
    }

    /**
     * Runs post action
     * @param command Command being processed
     * @param threadId Thread ID
     * @param dispatcherId Dispatcher ID
     * @param instructions AI instructions
     * @param soFar Data so far
     * @param updateStateData Updates state data
     * @returns Continuation for post message result
     * @protected
     */
    protected abstract doPost(
        command: VertexAiChatCommand,
        threadId: string,
        dispatcherId: string,
        instructions: VertexAiSystemInstructions<ChatData>,
        soFar: ChatData,
        updateStateData: (data: ChatData) => Promise<ChatData>
    ): Promise<Continuation<PostMessageResult<ChatData>>>;

    /**
     * Creates a post dispatch function
     * @param command Command being processed
     * @param dispatcherId Dispatcher ID
     * @param updateData Updates chat data
     * @returns Tools dispatching function
     * @protected
     */
    protected getPostDispatch(
        command: VertexAiChatCommand,
        dispatcherId: string,
        updateData: (data: ChatData) => Promise<ChatData>
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
                actionData: ["continuePost", ...command.actionData.slice(1)],
                continuation: continuationRequest
            });

            return await dispatcher.dispatch(
                data,
                toolCalls,
                updateData,
                getContinuationCommand
            );
        };
    }

    async doDispatch(
        command: VertexAiChatCommand,
        state: ChatState<VertexAiAssistantConfig, ChatData>,
        control: DispatchControl<VertexAiChatActions, ChatData>
    ): Promise<void> {
        logger.d("Posting messages...");
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
            state.data,
            async (data) => {
                await control.safeUpdate(async (_tx, updateChatState) => updateChatState({data: data}));
                return data;
            }
        );

        if (response.isResolved()) {
            logger.d("Resolved");

            const newData = response.value.data;

            await control.safeUpdate(async (_tx, updateChatState) => {
                updateChatState({data: newData});
            });

            await this.processMessages(
                command,
                {...state, data: newData},
                async (messages, _document, _state, mpc) => {
                    await mpc.safeUpdate(async (_tx, _updateState, saveMessages) => {
                        saveMessages(messages);
                    });
                    await this.continueNextInQueue(control, command);
                },
                control,
                this.messageMiddleware,
                response.value.messages
            );
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
        soFar: ChatData,
        updateStateData: (data: ChatData) => Promise<ChatData>
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        return await this.wrapper.postMessage(
            threadId,
            instructions,
            (await this.getMessages(command.commonData.chatDocumentPath, command.commonData.dispatchId)).map((it) => it.text),
            soFar,
            this.getPostDispatch(command, dispatcherId, updateStateData)
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
        updateStateData: (data: ChatData) => Promise<ChatData>
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        return await this.wrapper.postMessage(
            threadId,
            instructions,
            isPostExplicitAction(command.actionData[0]) ? (command.actionData[0].messages || []) : [],
            soFar,
            this.getPostDispatch(command, dispatcherId, updateStateData)
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
        instructions: VertexAiSystemInstructions<ChatData>,
        soFar: ChatData,
        updateStateData: (data: ChatData) => Promise<ChatData>
    ): Promise<Continuation<PostMessageResult<ChatData>>> {
        const dispatcher = this.getDispatcherFactory().getDispatcher<VertexAiChatActions, VertexAiContinuationCommand, ChatData>(
            command.commonData.chatDocumentPath,
            dispatcherId
        );

        const dc = await dispatcher.dispatchCommand(
            soFar,
            command,
            updateStateData,
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
                    updateStateData,
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
