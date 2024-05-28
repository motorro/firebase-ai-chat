import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatWorker,
    logger,
    Meta,
    TaskScheduler,
    ToolContinuationFactory
} from "@motorro/firebase-ai-chat-core";
import {CreateWorker} from "./workers/CreateWorker";
import {CloseWorker} from "./workers/CloseWorker";
import {PostWorker} from "./workers/PostWorker";
import {RetrieveWorker} from "./workers/RetrieveWorker";
import {RunWorker} from "./workers/RunWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {PostExplicitWorker} from "./workers/PostExplicitWorker";
import {HandBackCleanupWorker} from "./workers/HandBackCleanupWorker";
import {RunContinuationWorker} from "./workers/RunContinuationWorker";
import {isOpenAiChatReq, OpenAiChatCommand} from "./data/OpenAiChatCommand";

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class OpenAiChatWorker implements ChatWorker {
    private firestore: FirebaseFirestore.Firestore;
    private scheduler: TaskScheduler;
    private wrapper: AiWrapper;
    private toolsDispatchFactory: ToolContinuationFactory;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationFactory
    ) {
        this.firestore = firestore;
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.toolsDispatchFactory = toolsDispatchFactory;
    }

    private getWorker(command: OpenAiChatCommand): ChatWorker | undefined {
        logger.d("Dispatching OpenAi command...");

        if (RunContinuationWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new RunContinuationWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
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
            return new PostWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (PostExplicitWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new PostExplicitWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (RetrieveWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new RetrieveWorker(this.firestore, this.scheduler, this.wrapper);
        }
        if (RunWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ExplicitPostWorker");
            return new RunWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory);
        }
        if (SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
        }

        logger.w("Unsupported command:", command);
        return undefined;
    }


    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        if (isOpenAiChatReq(req)) {
            const worker = this.getWorker(req.data);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
