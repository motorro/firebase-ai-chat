import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatWorker,
    logger,
    Meta,
    TaskScheduler,
    ToolContinuationDispatcherFactory,
    toolContinuationDispatcherFactory,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {CreateWorker} from "./workers/CreateWorker";
import {CloseWorker} from "./workers/CloseWorker";
import {ContinuePostWorker, ExplicitPostWorker, PostWorker} from "./workers/PostWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";
import {HandBackCleanupWorker} from "./workers/HandBackCleanupWorker";
import {isVertexAiChatReq, VertexAiChatCommand} from "./data/VertexAiChatCommand";

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

    private getWorker(command: VertexAiChatCommand): ChatWorker | undefined {
        logger.d("Dispatching VertexAi command...");

        if (ContinuePostWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new ContinuePostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }

        const action = command.actionData[0];
        if (CloseWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CloseWorker");
            return new CloseWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (CreateWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CreateWorker");
            return new CreateWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (HandBackCleanupWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with HandBackCleanupWorker");
            return new HandBackCleanupWorker(this.wrapper);
        }
        if (PostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostWorker");
            return new PostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }
        if (ExplicitPostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new ExplicitPostWorker(this.firestore, this.scheduler, this.wrapper, this.instructions, this.getContinuationFactory);
        }
        if (SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
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
        getContinuationFactory?: () => ToolContinuationDispatcherFactory
    ) {
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.instructions = instructions;
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
                this.scheduler
            );
        });
    }

    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        if (isVertexAiChatReq(req)) {
            const worker = this.getWorker(req.data);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
