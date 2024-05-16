import { ChatData } from "../data/ChatState";
import { DispatchError, ToolsDispatcher } from "../ToolsDispatcher";
import { ContinuationCommand, ContinuationRequestToolData, ToolCallData, ToolCallRequest, ToolsContinuationData } from "../data/ContinuationCommand";
import { firestore } from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
/**
 * Dispatch data
 */
export interface DispatchData<DATA extends ChatData> {
    /**
     * Dispatch was suspended if true - otherwise resolved
     */
    readonly suspended: boolean;
    /**
     * Data state after dispatch
     */
    readonly data: DATA;
    /**
     * Tools state after dispatch
     */
    readonly tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>;
}
/**
 * Runs passed tools and manages continuation and call status
 */
export interface ToolsContinuationDispatchRunner<DATA extends ChatData> {
    /**
     * Dispatches calls
     * @param continuationData Current continuation data
     * @param tools Tool calls
     * @param getContinuationCommand Continuation command factory
     * @returns Updated continuation state
     */
    dispatch(continuationData: ToolsContinuationData<DATA>, tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>, getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>): Promise<DispatchData<DATA>>;
}
/**
 * Runs passed tools sequentially suspending continuation if suspended
 * If any call fails - also fails other subsequent calls
 */
export declare class SequentialToolsContinuationDispatchRunner<DATA extends ChatData> implements ToolsContinuationDispatchRunner<DATA> {
    private readonly dispatchers;
    private readonly formatContinuationError;
    constructor(dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, formatContinuationError?: (failed: ToolCallRequest, error: DispatchError) => DispatchError);
    dispatch(continuationData: ToolsContinuationData<DATA>, tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>, getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>): Promise<DispatchData<DATA>>;
    private getDispatcher;
}
export declare function commonFormatContinuationError(toolCall: ToolCallRequest): DispatchError;
