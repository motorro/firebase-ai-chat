import {Request} from "firebase-functions/lib/common/providers/tasks";
import {
    ChatCommand,
    ChatData,
    ChatWorker,
    DispatchControl, logger,
    Meta,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {VertexAiChatActions} from "./data/VertexAiChatAction";
import {VertexAiAssistantConfig} from "./data/VertexAiAssistantConfig";
import {BaseVertexAiWorker} from "./workers/BaseVertexAiWorker";
import {CreateWorker} from "./workers/CreateWorker";
import {CloseWorker} from "./workers/CloseWorker";
import {PostWorker} from "./workers/PostWorker";
import {SwitchToUserWorker} from "./workers/SwitchToUserWorker";
import {AiWrapper} from "./AiWrapper";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";

export type OpenAiDispatchControl = DispatchControl<VertexAiChatActions, VertexAiAssistantConfig, ChatData>;

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class VertexAiChatWorker implements ChatWorker {
    private workers: ReadonlyArray<BaseVertexAiWorker>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>>
    ) {
        this.workers = [
            new CloseWorker(firestore, scheduler, wrapper, instructions),
            new CreateWorker(firestore, scheduler, wrapper, instructions),
            new PostWorker(firestore, scheduler, wrapper, instructions),
            new SwitchToUserWorker(firestore, scheduler, wrapper, instructions)
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
