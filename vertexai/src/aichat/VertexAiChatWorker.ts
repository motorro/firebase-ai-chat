import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCleaner,
    ChatCleanupRegistrar,
    ChatCommand,
    ChatData,
    ChatWorker,
    CommandScheduler,
    DispatchError,
    MessageMiddleware,
    Meta,
    tagLogger,
    TaskScheduler,
    ToolCallRequest,
    ToolContinuationDispatcherFactory,
    toolContinuationDispatcherFactory,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {CreateWorker} from "./workers/CreateWorker";
import {ContinuePostWorker, ExplicitPostWorker, PostWorker} from "./workers/PostWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";
import {CleanupWorker} from "./workers/CleanupWorker";
import {isVertexAiChatReq, VertexAiChatCommand} from "./data/VertexAiChatCommand";
import {HandBackWorker, HandOverWorker} from "./workers/HandOver";

const logger = tagLogger("VertexAiChatWorker");

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class VertexAiChatWorker implements ChatWorker {
    private readonly firestore: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly wrapper: AiWrapper;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>;
    private readonly getContinuationFactory: () => ToolContinuationDispatcherFactory;
    private readonly chatCleanerFactory: (queueName: string) => ChatCleaner;
    private readonly chatCleanupRegistrar: ChatCleanupRegistrar;
    private readonly logData: boolean;
    private readonly messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>;
    private readonly commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>;

    private getWorker(command: VertexAiChatCommand, queueName: string): ChatWorker | undefined {
        logger.d("Dispatching VertexAi command...");

        const cleaner: ChatCleaner = this.chatCleanerFactory(queueName);

        if (ContinuePostWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new ContinuePostWorker(
                this.firestore,
                this.scheduler,
                this.wrapper,
                this.instructions,
                this.getContinuationFactory,
                cleaner,
                this.logData,
                this.messageMiddleware
            );
        }

        const action = command.actionData[0];
        if (CreateWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CreateWorker");
            return new CreateWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.chatCleanupRegistrar);
        }
        if (CleanupWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CleanupWorker");
            return new CleanupWorker(this.wrapper);
        }
        if (PostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostWorker");
            return new PostWorker(
                this.firestore,
                this.scheduler,
                this.wrapper,
                this.instructions,
                this.getContinuationFactory,
                cleaner,
                this.logData,
                this.messageMiddleware
            );
        }
        if (ExplicitPostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new ExplicitPostWorker(
                this.firestore,
                this.scheduler,
                this.wrapper,
                this.instructions,
                this.getContinuationFactory,
                cleaner,
                this.logData,
                this.messageMiddleware
            );
        }
        if (SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        if (HandOverWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with HandOverWorker");
            return new HandOverWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.commandSchedulers(queueName));
        }
        if (HandBackWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with HandBackWorker");
            return new HandBackWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.commandSchedulers(queueName));
        }

        logger.w("Unsupported command:", command);
        return undefined;
    }

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>,
        formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError,
        chatCleanupRegistrar: ChatCleanupRegistrar,
        chatCleanerFactory: (queueName: string) => ChatCleaner,
        logData: boolean,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        messageMiddleware: ReadonlyArray<MessageMiddleware<any, any>>,
        commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>,
        getContinuationFactory?: () => ToolContinuationDispatcherFactory,
    ) {
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.instructions = instructions;
        this.commandSchedulers = commandSchedulers;
        this.getContinuationFactory = getContinuationFactory || (() => {
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
            const dispatchers: Record<string, ToolsDispatcher<any>> = {};
            Object.keys(this.instructions).forEach((id) => {
                const dispatcher = this.instructions[id]?.tools?.dispatcher;
                if (undefined !== dispatcher) {
                    dispatchers[id] = dispatcher;
                }
            });
            return toolContinuationDispatcherFactory(
                this.firestore,
                dispatchers,
                this.scheduler,
                formatContinuationError,
                logData
            );
        });
        this.chatCleanerFactory = chatCleanerFactory;
        this.chatCleanupRegistrar = chatCleanupRegistrar;
        this.logData = logData;
        this.messageMiddleware = messageMiddleware;
    }

    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        if (isVertexAiChatReq(req)) {
            const worker = this.getWorker(req.data, req.queueName);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
