import { ChatData } from "../data/ChatState";
import { ToolsContinuationScheduler } from "./ToolsContinuationScheduler";
import { ToolsDispatcher } from "../ToolsDispatcher";
import { ToolsContinuationDispatcher } from "./ToolsContinuationDispatcher";
import { ContinuationCommand } from "../data/ContinuationCommand";
import { TaskScheduler } from "../TaskScheduler";
/**
 * Continuation components factory
 */
export interface ToolContinuationFactory {
    /**
     * Creates tool to handle initial tool dispatch
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @return Tool continuation dispatcher
     */
    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<A, C, DATA>;
    /**
     * Tool to handle dispatch continuation
     * @param queueName Queue name to schedule continuation commands to
     * @return Tool continuation scheduler
     */
    getScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>;
}
export declare class ToolContinuationFactoryImpl implements ToolContinuationFactory {
    readonly db: FirebaseFirestore.Firestore;
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    readonly scheduler: TaskScheduler;
    constructor(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, scheduler: TaskScheduler);
    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(chatDocumentPath: string, dispatcherId: string): ToolsContinuationDispatcher<A, C, DATA>;
    getScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>;
}
