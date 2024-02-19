import { AiWrapper } from "./AiWrapper";
import { ToolsDispatcher } from "./ToolsDispatcher";
import { ChatCommand } from "./data/ChatCommand";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class ChatWorker {
    private readonly db;
    private readonly wrapper;
    private readonly dispatchers;
    private readonly defaultDispatcher;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore: FirebaseFirestore.Firestore, wrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>);
    /**
     * Set as a trigger to document creation in command collection
     * @param command Command data
     */
    runCommand(command: ChatCommand): Promise<void>;
    /**
     * Posts messages and runs assistant
     * @param state Chat state
     * @param command Command data
     * @private
     */
    private runPostChat;
    private closeThread;
    private updateWithCheck;
    private updateIfChecked;
    private processWithCheck;
}
