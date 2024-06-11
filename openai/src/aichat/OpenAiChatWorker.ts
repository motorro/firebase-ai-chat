import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatWorker,
    Meta,
    tagLogger,
    TaskScheduler,
    ToolContinuationDispatcherFactory
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

const logger = tagLogger("OpenAiChatWorker");

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class OpenAiChatWorker implements ChatWorker {
    private readonly firestore: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly wrapper: AiWrapper;
    private readonly toolsDispatchFactory: ToolContinuationDispatcherFactory;
    private readonly logData: boolean;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationDispatcherFactory,
        logData: boolean
    ) {
        this.firestore = firestore;
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.toolsDispatchFactory = toolsDispatchFactory;
        this.logData = logData;
    }

    private getWorker(command: OpenAiChatCommand): ChatWorker | undefined {
        logger.d("Dispatching OpenAi command...");

        if (RunContinuationWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new RunContinuationWorker(
                this.firestore,
                this.scheduler,
                this.wrapper,
                this.toolsDispatchFactory,
                this.logData
            );
        }

        const action = command.actionData[0];
        if (CloseWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CloseWorker");
            return new CloseWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
        }
        if (CreateWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with CreateWorker");
            return new CreateWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
        }
        if (HandBackCleanupWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with HandBackCleanupWorker");
            return new HandBackCleanupWorker(this.wrapper);
        }
        if (PostWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostWorker");
            return new PostWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
        }
        if (PostExplicitWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostExplicitWorker");
            return new PostExplicitWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
        }
        if (RetrieveWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RetrieveWorker");
            return new RetrieveWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
        }
        if (RunWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RunWorker");
            return new RunWorker(this.firestore, this.scheduler, this.wrapper, this.toolsDispatchFactory, this.logData);
        }
        if (SwitchToUserWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with SwitchToUserWorker");
            return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper, this.logData);
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
