import { AiWrapper } from "./AiWrapper";
import { ToolsDispatcher } from "./ToolsDispatcher";
import { ChatCommandQueue } from "./data/ChatCommandQueue";
import { TaskScheduler } from "./TaskScheduler";
import { Request } from "firebase-functions/lib/common/providers/tasks";
/**
 * Chat worker that dispatches chat commands and runs AI
 */
export declare class ChatWorker {
    private readonly db;
    private readonly wrapper;
    private readonly scheduler;
    private readonly dispatchers;
    private readonly defaultDispatcher;
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, wrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>);
    /**
     * Dispatches command
     * @param req Dispatch request
     */
    dispatch(req: Request<ChatCommandQueue>): Promise<void>;
    /**
     * Creates thread
     * @param command Command data
     * @private
     */
    private runCreateThread;
    /**
     * Posts user messages of current dispatch
     * @param command Command data
     * @private
     */
    private runPostMessages;
    /**
     * Runs assistant
     * @param command Command data
     * @private
     */
    private runRun;
    /**
     * Retrieves new messages
     * @param command Command data
     * @private
     */
    private runRetrieve;
    /**
     * Closes chat
     * @param command Command data
     * @private
     */
    private runClose;
    /**
     * Creates message collection reference
     * @param chatDocumentPath Chat document path
     * @return Messages collection reference
     * @private
     */
    private getMessageCollection;
    private checkState;
    private withCheckedState;
    private updateWithCheck;
}
