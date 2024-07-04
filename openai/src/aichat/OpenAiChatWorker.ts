import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCleaner,
    ChatCleanupRegistrar,
    ChatCommand,
    ChatData,
    ChatWorker,
    CommandScheduler,
    MessageMiddleware,
    Meta,
    tagLogger,
    TaskScheduler,
    ToolContinuationDispatcherFactory
} from "@motorro/firebase-ai-chat-core";
import {CreateWorker} from "./workers/CreateWorker";
import {PostWorker} from "./workers/PostWorker";
import {RetrieveWorker} from "./workers/RetrieveWorker";
import {RunWorker} from "./workers/RunWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {PostExplicitWorker} from "./workers/PostExplicitWorker";
import {CleanupWorker} from "./workers/CleanupWorker";
import {RunContinuationWorker} from "./workers/RunContinuationWorker";
import {isOpenAiChatReq, OpenAiChatCommand} from "./data/OpenAiChatCommand";
import {HandBackWorker, HandOverWorker} from "./workers/HandOver";

const logger = tagLogger("OpenAiChatWorker");

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class OpenAiChatWorker implements ChatWorker {
    private readonly firestore: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly wrapper: AiWrapper;
    private readonly toolsDispatchFactory: ToolContinuationDispatcherFactory;
    private readonly chatCleanerFactory: (queueName: string) => ChatCleaner;
    private readonly chatCleanupRegistrar: ChatCleanupRegistrar;
    private readonly logData: boolean;
    private readonly messageMiddleware: ReadonlyArray<MessageMiddleware<ChatData>>;
    private readonly commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationDispatcherFactory,
        chatCleanupRegistrar: ChatCleanupRegistrar,
        chatCleanerFactory: (queueName: string) => ChatCleaner,
        logData: boolean,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        messageMiddleware: ReadonlyArray<MessageMiddleware<any, any>>,
        commandSchedulers: (queueName: string) => ReadonlyArray<CommandScheduler>
    ) {
        this.firestore = firestore;
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
        this.toolsDispatchFactory = toolsDispatchFactory;
        this.chatCleanerFactory = chatCleanerFactory;
        this.chatCleanupRegistrar = chatCleanupRegistrar;
        this.logData = logData;
        this.messageMiddleware = messageMiddleware;
        this.commandSchedulers = commandSchedulers;
    }

    private getWorker(command: OpenAiChatCommand, queueName: string): ChatWorker | undefined {
        logger.d("Dispatching OpenAi command...");

        const cleaner: ChatCleaner = this.chatCleanerFactory(queueName);

        if (RunContinuationWorker.isSupportedCommand(command)) {
            logger.d("Action to be handled with ContinuePostWorker");
            return new RunContinuationWorker(
                this.firestore,
                this.scheduler,
                this.wrapper,
                this.toolsDispatchFactory,
                cleaner,
                this.logData
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
            return new PostWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        if (PostExplicitWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with PostExplicitWorker");
            return new PostExplicitWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData);
        }
        if (RetrieveWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RetrieveWorker");
            return new RetrieveWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.logData, this.messageMiddleware);
        }
        if (RunWorker.isSupportedAction(action)) {
            logger.d("Action to be handled with RunWorker");
            return new RunWorker(this.firestore, this.scheduler, this.wrapper, cleaner, this.toolsDispatchFactory, this.logData);
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


    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        if (isOpenAiChatReq(req)) {
            const worker = this.getWorker(req.data, req.queueName);
            if (undefined !== worker) {
                return await worker.dispatch(req, onQueueComplete);
            }
        }
        return false;
    }
}
