import {ChatData} from "../data/ChatState";
import {DispatchError, ToolsDispatcher} from "../ToolsDispatcher";
import {SequentialToolsContinuationDispatchRunner} from "./ToolsContinuationDispatchRunner";
import {ToolsContinuationDispatcher, ToolsContinuationDispatcherImpl} from "./ToolsContinuationDispatcher";
import {ToolCallRequest} from "../data/ContinuationCommand";
import {TaskScheduler} from "../TaskScheduler";

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
    getDispatcher<DATA extends ChatData>(
        chatDocumentPath: string,
        dispatcherId: string
    ): ToolsContinuationDispatcher<DATA>
}

export class ToolContinuationDispatcherFactoryImpl implements ToolContinuationDispatcherFactory {
    readonly db: FirebaseFirestore.Firestore;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>;
    readonly scheduler: TaskScheduler;
    private readonly formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError;
    private readonly logData: boolean;

    constructor(
        db: FirebaseFirestore.Firestore,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>,
        scheduler: TaskScheduler,
        formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError,
        logData: boolean
    ) {
        this.db = db;
        this.dispatchers = dispatchers;
        this.scheduler = scheduler;
        this.formatContinuationError = formatContinuationError;
        this.logData = logData;
    }

    getDispatcher<DATA extends ChatData>(
        chatDocumentPath: string,
        dispatcherId: string
    ): ToolsContinuationDispatcher<DATA> {
        return new ToolsContinuationDispatcherImpl<DATA>(
            chatDocumentPath,
            dispatcherId,
            this.db,
            new SequentialToolsContinuationDispatchRunner(this.dispatchers, this.formatContinuationError, this.logData),
            this.logData
        );
    }
}
