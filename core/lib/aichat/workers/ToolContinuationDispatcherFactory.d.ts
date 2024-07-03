import { ChatData } from "../data/ChatState";
import { DispatchError, ToolsDispatcher } from "../ToolsDispatcher";
import { ToolsContinuationDispatcher } from "./ToolsContinuationDispatcher";
import { ToolCallRequest } from "../data/ContinuationCommand";
import { TaskScheduler } from "../TaskScheduler";
/**
 * Continuation dispatcher factory
 */
export interface ToolContinuationDispatcherFactory {
    /**
     * Creates tool to handle initial tool dispatch
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @return Tool continuation dispatcher
     */
    getDispatcher<DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<DATA>;
}
export declare class ToolContinuationDispatcherFactoryImpl implements ToolContinuationDispatcherFactory {
    readonly db: FirebaseFirestore.Firestore;
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>;
    readonly scheduler: TaskScheduler;
    private readonly formatContinuationError;
    private readonly logData;
    constructor(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>, scheduler: TaskScheduler, formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError, logData: boolean);
    getDispatcher<DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<DATA>;
}
