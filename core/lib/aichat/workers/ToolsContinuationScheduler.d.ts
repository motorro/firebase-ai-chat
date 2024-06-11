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
 * Creates tool continuation scheduler
 */
export interface ToolsContinuationSchedulerFactory {
    /**
     * Creates tool continuation scheduler
     * @param queueName Queue name to schedule continuation to
     * @returns Tools continuation scheduler
     */
    create<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>;
}
export declare class ToolsContinuationSchedulerFactoryImpl implements ToolsContinuationSchedulerFactory {
    private readonly firebase;
    private readonly scheduler;
    private readonly logData;
    constructor(firebase: FirebaseFirestore.Firestore, scheduler: TaskScheduler, logData: boolean);
    create<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>;
}
/**
 * Continuation implementation
 */
export declare class ToolsContinuationSchedulerImpl<in DATA extends ChatData> implements ToolsContinuationScheduler<DATA> {
    private readonly queueName;
    private readonly db;
    private readonly scheduler;
    private readonly logData;
    constructor(queueName: string, db: FirebaseFirestore.Firestore, scheduler: TaskScheduler, logData?: boolean);
    continue(command: ContinuationCommand<unknown>, response: DispatchResult<DATA>): Promise<void>;
}
