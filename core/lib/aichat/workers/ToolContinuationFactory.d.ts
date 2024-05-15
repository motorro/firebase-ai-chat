import { AssistantConfig, ChatData } from "../data/ChatState";
import { ToolsContinuation } from "./ToolsContinuation";
import { ToolsDispatcher } from "../ToolsDispatcher";
import { ToolsContinuationDispatcher } from "./ToolsContinuationDispatcher";
import { ChatCommandData } from "../data/ChatCommandData";
import { Meta } from "../data/Meta";
import { ToolCallsResult } from "../data/ContinuationCommand";
import { TaskScheduler } from "../TaskScheduler";
import { ChatWorker } from "./ChatWorker";
/**
 * Continuation components factory
 */
export interface ToolContinuationFactory {
    /**
     * Creates tool to handle initial tool dispatch
     * @param commonData Common command data
     * @param dispatcherId Dispatcher to use
     * @return Tool continuation dispatcher
     */
    getDispatcher<DATA extends ChatData, M extends Meta = Meta>(commonData: ChatCommandData, dispatcherId: string): ToolsContinuationDispatcher<DATA, M> | PromiseLike<ToolsContinuationDispatcher<DATA, M>>;
    /**
     * Tool to handle dispatch continuation
     * @param queueName Queue name to schedule continuation commands to
     * @return Tool continuation processor
     */
    getContinuation<DATA extends ChatData, M extends Meta = Meta>(queueName: string): ToolsContinuation<DATA, M> | PromiseLike<ToolsContinuation<DATA, M>>;
    /**
     * Builds a worker to handle continuation commands
     * @param isSupportedMeta Function to check if continuation meta matches the worker
     * @param onResolved Callback called when everything is dispatched
     * @return Tool continuation worker
     */
    getWorker<AC extends AssistantConfig, DATA extends ChatData, M extends Meta = Meta>(isSupportedMeta: (meta: Meta) => meta is M, onResolved: (data: ChatCommandData, result: ToolCallsResult<DATA, M>) => Promise<void>): ChatWorker;
}
export declare class ToolContinuationFactoryImpl implements ToolContinuationFactory {
    readonly db: FirebaseFirestore.Firestore;
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    readonly scheduler: TaskScheduler;
    constructor(db: FirebaseFirestore.Firestore, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, scheduler: TaskScheduler);
    getDispatcher<DATA extends ChatData, M extends Meta = Meta>(commonData: ChatCommandData, dispatcherId: string): ToolsContinuationDispatcher<DATA, M> | PromiseLike<ToolsContinuationDispatcher<DATA, M>>;
    getContinuation<DATA extends ChatData, M extends Meta = Meta>(queueName: string): ToolsContinuation<DATA, M> | PromiseLike<ToolsContinuation<DATA, M>>;
    getWorker<AC extends AssistantConfig, DATA extends ChatData, M extends Meta>(isSupportedMeta: (meta: Meta) => meta is M, onResolved: (data: ChatCommandData, result: ToolCallsResult<DATA, M>) => Promise<void>): ChatWorker;
}
