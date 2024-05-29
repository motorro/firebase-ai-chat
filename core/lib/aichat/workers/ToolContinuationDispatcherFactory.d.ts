import { ChatData } from "../data/ChatState";
import { ToolsDispatcher } from "../ToolsDispatcher";
import { ToolsContinuationDispatcher } from "./ToolsContinuationDispatcher";
import { ContinuationCommand } from "../data/ContinuationCommand";
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
    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<A, C, DATA>;
}
export declare class ToolContinuationDispatcherFactoryImpl implements ToolContinuationDispatcherFactory {
    readonly db: FirebaseFirestore.Firestore;
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    readonly scheduler: TaskScheduler;
    constructor(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, scheduler: TaskScheduler);
    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<A, C, DATA>;
}
