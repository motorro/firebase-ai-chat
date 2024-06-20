import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {tagLogger} from "../../logging";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import DocumentReference = firestore.DocumentReference;
import {Collections} from "../data/Collections";
import CollectionReference = firestore.CollectionReference;
import {BoundChatCommand, ChatCommand, isBoundChatCommand} from "../data/ChatCommand";
import {TaskScheduler} from "../TaskScheduler";

const logger = tagLogger("Cleaner");

export interface ChatCleanupRegistrar {
    /**
     * Registers a cleanup command
     * @param command Command to be executed when chat is closed
     */
    register: (command: ChatCommand<unknown>) => Promise<void>
}

/**
 * Chat resource cleaner
 */
export interface ChatCleaner {
    /**
     * Schedules cleanup commands stored inside chat data
     * @param chatDocumentPath Chat document
     */
    cleanup: (chatDocumentPath: string) => Promise<void>
}

export class CommonChatCleanupRegistrar {
    private readonly db: FirebaseFirestore.Firestore;

    /**
     * Constructor
     * @param db Firestore
     */
    constructor(db: Firestore) {
        this.db = db;
    }

    async register(command: ChatCommand<unknown>): Promise<void> {
        logger.d("Registering cleanup: ", JSON.stringify(command));
        const chatDoc = this.db.doc(command.commonData.chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, ChatData>>;
        const cleanup = chatDoc.collection(Collections.cleanup) as CollectionReference<ChatCommand<unknown> | BoundChatCommand<unknown>>;
        await cleanup.doc().set(command);
    }
}

export class CommonChatCleaner implements ChatCleaner {
    private readonly db: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly queueName: string;

    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Task scheduler
     * @param queueName Task queue name for cleanup
     */
    constructor(db: Firestore, scheduler: TaskScheduler, queueName: string) {
        this.db = db;
        this.scheduler = scheduler;
        this.queueName = queueName;
    }

    async cleanup(chatDocumentPath: string): Promise<void> {
        logger.d("Cleanup requested for: ", chatDocumentPath);
        const chatDoc = this.db.doc(chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, ChatData>>;
        const cleanup = chatDoc.collection(Collections.cleanup) as CollectionReference<ChatCommand<unknown> | BoundChatCommand<unknown>>;
        const commands = (await cleanup.get()).docs;
        for (const commandDoc of commands) {
            const command = commandDoc.data();
            if (undefined === command) {
                continue;
            }

            logger.d("Cleaning-up: ", JSON.stringify(command));

            if (isBoundChatCommand(command)) {
                await this.scheduler.schedule(command.queueName, command.command);
            } else {
                await this.scheduler.schedule(this.queueName, command);
            }
        }
    }
}
