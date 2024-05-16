import { TaskScheduler, ToolContinuationFactory, ChatWorker } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { AiWrapper } from "../AiWrapper";
import { WorkerFactory } from "./WorkerFactory";
export declare class RunFactory extends WorkerFactory {
    private readonly toolsDispatchFactory;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param toolsDispatchFactory Tool dispatcher factory
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationFactory);
    protected isSupportedAction(action: unknown): action is OpenAiChatAction;
    create(): ChatWorker;
}
