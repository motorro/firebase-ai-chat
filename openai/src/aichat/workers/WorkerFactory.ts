import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {ChatCommand, ChatWorker, TaskScheduler} from "@motorro/firebase-ai-chat-core";
import {AiWrapper} from "../AiWrapper";
import {engineId} from "../../engineId";

export abstract class WorkerFactory {
    protected readonly firestore: FirebaseFirestore.Firestore;
    protected readonly scheduler: TaskScheduler;
    protected readonly wrapper: AiWrapper;

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
    ) {
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
    }

    /**
     * Checks if command is supported
     * @param command Command to check
     * @return True if command is supported
     */
    isSupportedCommand(command: ChatCommand<unknown>): boolean {
        return "engine" in command && engineId === command.engine
            && Array.isArray(command.actionData)
            && undefined !== command.actionData[0]
            && this.isSupportedAction(command.actionData[0]);
    }

    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return false;
    }

    /**
     * Creates chat worker
     * @param queueName Current queue name
     */
    abstract create(queueName: string): ChatWorker
}