import {ChatData} from "../data/ChatState";
import {ToolContinuationSchedulerImpl, ToolsContinuationScheduler} from "./ToolsContinuationScheduler";
import {ToolsDispatcher} from "../ToolsDispatcher";
import {SequentialToolsContinuationDispatchRunner} from "./ToolsContinuationDispatchRunner";
import {ToolsContinuationDispatcher, ToolsContinuationDispatcherImpl} from "./ToolsContinuationDispatcher";
import {ContinuationCommand} from "../data/ContinuationCommand";
import {TaskScheduler} from "../TaskScheduler";

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
    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(
        chatDocumentPath: string,
        dispatcherId: string
    ): ToolsContinuationDispatcher<A, C, DATA>

    /**
     * Tool to handle dispatch continuation
     * @param queueName Queue name to schedule continuation commands to
     * @return Tool continuation scheduler
     */
    getScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>
}

export class ToolContinuationFactoryImpl implements ToolContinuationFactory {
    readonly db: FirebaseFirestore.Firestore;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    readonly scheduler: TaskScheduler;

    constructor(
        db: FirebaseFirestore.Firestore,
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>,
        scheduler: TaskScheduler
    ) {
        this.db = db;
        this.dispatchers = dispatchers;
        this.scheduler = scheduler;
    }

    getDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData>(
        chatDocumentPath: string,
        dispatcherId: string
    ): ToolsContinuationDispatcher<A, C, DATA> {
        return new ToolsContinuationDispatcherImpl<A, C, DATA>(
            chatDocumentPath,
            dispatcherId,
            this.db,
            new SequentialToolsContinuationDispatchRunner(this.dispatchers)
        );
    }

    getScheduler<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA> {
        return new ToolContinuationSchedulerImpl(
            queueName,
            this.db,
            this.scheduler
        );
    }
}
