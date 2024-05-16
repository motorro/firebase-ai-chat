import { ChatCommand, ChatWorker, TaskScheduler, ToolContinuationFactory } from "@motorro/firebase-ai-chat-core";
import { AiWrapper } from "../AiWrapper";
import { WorkerFactory } from "./WorkerFactory";
export declare class RunContinuationFactory extends WorkerFactory {
    private readonly toolsDispatchFactory;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param toolsDispatchFactory Tool dispatcher factory
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, toolsDispatchFactory: ToolContinuationFactory);
    /**
     * Checks if command is supported
     * @param command Command to check
     * @return True if command is supported
     */
    isSupportedCommand(command: ChatCommand<unknown>): boolean;
    create(): ChatWorker;
}
