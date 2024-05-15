import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { ChatWorker, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "../AiWrapper";
export declare abstract class WorkerFactory {
    protected readonly firestore: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    protected readonly wrapper: AiWrapper;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper);
    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    abstract isSupportedAction(action: unknown): action is OpenAiChatAction;
    /**
     * Creates chat worker
     */
    abstract create(): ChatWorker;
}
