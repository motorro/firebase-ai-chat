import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatData,
    ChatWorker,
    DispatchControl, logger,
    Meta,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {OpenAiChatActions} from "./data/OpenAiChatAction";
import {OpenAiAssistantConfig} from "./data/OpenAiAssistantConfig";
import {CreateWorker} from "./workers/CreateWorker";
import {CloseWorker} from "./workers/CloseWorker";
import {PostWorker} from "./workers/PostWorker";
import {RetrieveWorker} from "./workers/RetrieveWorker";
import {RunWorker} from "./workers/RunWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {PostExplicitWorker} from "./workers/PostExplicitWorker";
import {HandBackCleanupWorker} from "./workers/HandBackCleanupWorker";

export type OpenAiDispatchControl = DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>;

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class OpenAiChatWorker implements ChatWorker {
    private workers: ReadonlyArray<ChatWorker>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
    ) {
        this.workers = [
            new CloseWorker(firestore, scheduler, wrapper),
            new CreateWorker(firestore, scheduler, wrapper),
            new PostWorker(firestore, scheduler, wrapper),
            new PostExplicitWorker(firestore, scheduler, wrapper),
            new RetrieveWorker(firestore, scheduler, wrapper),
            new RunWorker(firestore, scheduler, wrapper),
            new SwitchToUserWorker(firestore, scheduler, wrapper),
            new HandBackCleanupWorker(wrapper)
        ];
    }
    async dispatch(
        req: Request<ChatCommand<unknown>>,
        onQueueComplete?: (chatDocumentPath: string, meta: Meta | null) => void | Promise<void>
    ): Promise<boolean> {
        for (let i = 0; i < this.workers.length; ++i) {
            if (await this.workers[i].dispatch(req, onQueueComplete)) {
                return true;
            }
        }
        logger.d("Didn't find worker for command:", JSON.stringify(req.data));
        return false;
    }
}
