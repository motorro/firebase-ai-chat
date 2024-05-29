import { DispatchResult } from "../ToolsDispatcher";
import { ChatData } from "../data/ChatState";
import { ContinuationCommand } from "../data/ContinuationCommand";
import { Meta } from "../data/Meta";
import { TaskScheduler } from "../TaskScheduler";
/**
 * Registers tool result and launches continuation command for the next dispatch
 */
export interface ToolsContinuation<DATA extends ChatData, M extends Meta = Meta> {
    /**
     * Continues with next result launching continuation command
     * @param command Continuation command
     * @param response Dispatch response to continue
     */
    continue(command: ContinuationCommand<M>, response: DispatchResult<DATA>): Promise<void>;
}
/**
 * Continuation implementation
 */
export declare class ToolContinuationImpl<DATA extends ChatData, M extends Meta = Meta> implements ToolsContinuation<DATA, M> {
    private readonly queueName;
    private readonly db;
    private readonly scheduler;
    constructor(queueName: string, db: FirebaseFirestore.Firestore, scheduler: TaskScheduler);
    continue(command: ContinuationCommand<M>, response: DispatchResult<DATA>): Promise<void>;
}
