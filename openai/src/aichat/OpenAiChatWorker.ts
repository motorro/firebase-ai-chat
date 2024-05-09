import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatData,
    ChatWorker,
    DispatchControl, logger,
    Meta,
    TaskScheduler,
    ToolsDispatcher
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
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>
    ) {
        this.workers = [
            new CloseWorker(firestore, scheduler, wrapper, dispatchers),
            new CreateWorker(firestore, scheduler, wrapper, dispatchers),
            new PostWorker(firestore, scheduler, wrapper, dispatchers),
            new PostExplicitWorker(firestore, scheduler, wrapper, dispatchers),
            new RetrieveWorker(firestore, scheduler, wrapper, dispatchers),
            new RunWorker(firestore, scheduler, wrapper, dispatchers),
            new SwitchToUserWorker(firestore, scheduler, wrapper, dispatchers),
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
