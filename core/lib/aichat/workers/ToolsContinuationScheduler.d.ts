import { DispatchResult } from "../ToolsDispatcher";
import { ChatData } from "../data/ChatState";
import { ContinuationCommand } from "../data/ContinuationCommand";
import { TaskScheduler } from "../TaskScheduler";
/**
 * Registers tool result and launches continuation command for the next dispatch
 */
export interface ToolsContinuationScheduler<in DATA extends ChatData> {
    /**
     * Continues with next result launching continuation command
     * @param command Continuation command
     * @param response Dispatch response to continue
     */
    continue(command: ContinuationCommand<unknown>, response: DispatchResult<DATA>): Promise<void>;
}
/**
 * Continuation implementation
 */
export declare class ToolContinuationSchedulerImpl<in DATA extends ChatData> implements ToolsContinuationScheduler<DATA> {
    private readonly queueName;
    private readonly db;
    private readonly scheduler;
    constructor(queueName: string, db: FirebaseFirestore.Firestore, scheduler: TaskScheduler);
    continue(command: ContinuationCommand<unknown>, response: DispatchResult<DATA>): Promise<void>;
}
