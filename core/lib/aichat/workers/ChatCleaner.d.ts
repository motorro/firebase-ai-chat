import { firestore } from "firebase-admin";
import Firestore = firestore.Firestore;
import { ChatCommand } from "../data/ChatCommand";
import { TaskScheduler } from "../TaskScheduler";
export interface ChatCleanupRegistrar {
    /**
     * Registers a cleanup command
     * @param command Command to be executed when chat is closed
     */
    register: (command: ChatCommand<unknown>) => Promise<void>;
}
/**
 * Chat resource cleaner
 */
export interface ChatCleaner {
    /**
     * Schedules cleanup commands stored inside chat data
     * @param chatDocumentPath Chat document
     */
    cleanup: (chatDocumentPath: string) => Promise<void>;
}
export declare class CommonChatCleanupRegistrar {
    private readonly db;
    /**
     * Constructor
     * @param db Firestore
     */
    constructor(db: Firestore);
    register(command: ChatCommand<unknown>): Promise<void>;
}
export declare class CommonChatCleaner implements ChatCleaner {
    private readonly db;
    private readonly scheduler;
    private readonly queueName;
    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Task scheduler
     * @param queueName Task queue name for cleanup
     */
    constructor(db: Firestore, scheduler: TaskScheduler, queueName: string);
    cleanup(chatDocumentPath: string): Promise<void>;
}
