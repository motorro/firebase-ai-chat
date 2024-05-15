import { ChatData } from "../data/ChatState";
import { ToolsContinuationDispatchRunner } from "./ToolsContinuationDispatchRunner";
import { ToolCallRequest, ToolCallsResult } from "../data/ContinuationCommand";
import { Continuation } from "../data/Continuation";
import { ChatCommandData } from "../data/ChatCommandData";
import { Meta } from "../data/Meta";
/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<DATA extends ChatData, M extends Meta = Meta> {
    /**
     * Dispatches tool calls
     * @param soFar Chat state so far
     * @param toolCalls Tool calls
     * @param meta Metadata to save with continuation
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(soFar: DATA, toolCalls: ReadonlyArray<ToolCallRequest<DATA>>, meta: Meta): Promise<Continuation<ToolCallsResult<DATA, M>>>;
}
export declare class ToolsContinuationDispatcherImpl<DATA extends ChatData, M extends Meta = Meta> implements ToolsContinuationDispatcher<DATA, M> {
    private readonly commonData;
    private readonly dispatcherId;
    private readonly chatDocument;
    private readonly db;
    private readonly dispatchRunner;
    /**
     * Constructor
     * @param commonData Common command data
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @return Tool calls continuation with at-once processed data or suspended
     */
    constructor(commonData: ChatCommandData, dispatcherId: string, db: FirebaseFirestore.Firestore, dispatchRunner: ToolsContinuationDispatchRunner<DATA>);
    dispatch(soFar: DATA, toolCalls: ReadonlyArray<ToolCallRequest<DATA>>, meta: M): Promise<Continuation<ToolCallsResult<DATA, M>>>;
}
