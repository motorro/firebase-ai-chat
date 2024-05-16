import {Request} from "firebase-functions/lib/common/providers/tasks";
import {ChatCommand, ChatWorker, Meta, TaskScheduler, ToolContinuationFactory} from "@motorro/firebase-ai-chat-core";
import {CreateFactory} from "./workers/CreateWorker";
import {CloseFactory} from "./workers/CloseWorker";
import {PostFactory} from "./workers/PostWorker";
import {RetrieveFactory} from "./workers/RetrieveWorker";
import {RunFactory} from "./workers/RunWorker";
import {SwitchToUserFactory} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {PostExplicitFactory} from "./workers/PostExplicitWorker";
import {HandBackCleanupFactory} from "./workers/HandBackCleanupWorker";
import {WorkerFactory} from "./workers/WorkerFactory";
import {RunContinuationFactory} from "./workers/RunContinuationWorker";

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class OpenAiChatWorker implements ChatWorker {
    private workers: ReadonlyArray<WorkerFactory>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        toolsDispatchFactory: ToolContinuationFactory
    ) {
        this.workers = [
            new CloseFactory(firestore, scheduler, wrapper),
            new CreateFactory(firestore, scheduler, wrapper),
            new PostFactory(firestore, scheduler, wrapper),
            new PostExplicitFactory(firestore, scheduler, wrapper),
            new RetrieveFactory(firestore, scheduler, wrapper),
            new RunFactory(firestore, scheduler, wrapper, toolsDispatchFactory),
            new SwitchToUserFactory(firestore, scheduler, wrapper),
            new HandBackCleanupFactory(firestore, scheduler, wrapper),
            new RunContinuationFactory(firestore, scheduler, wrapper, toolsDispatchFactory)
        ];
    }

    private getFactory(req: Request<ChatCommand<unknown>>): WorkerFactory | false | undefined {
        return this.workers.find((w) => w.isSupportedCommand(req.data));
    }

    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        const factory = this.getFactory(req);
        if (factory) {
            return await factory.create(req.queueName).dispatch(req, onQueueComplete);
        } else {
            return false;
        }
    }
}
