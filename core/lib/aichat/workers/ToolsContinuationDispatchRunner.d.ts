import { ChatData } from "../data/ChatState";
import { ChatDispatchData, DispatchError, ToolsDispatcher } from "../ToolsDispatcher";
import { ContinuationCommand, ContinuationRequestToolData, ToolCallData, ToolCallRequest, ToolsContinuationData } from "../data/ContinuationCommand";
import { firestore } from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import { ChatMeta } from "../data/Meta";
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
export interface ToolsContinuationDispatchRunner<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Dispatches calls
     * @param soFar Current chat data
     * @param continuationData Current continuation data
     * @param tools Tool calls
     * @param chatData Chat data to provide to dispatcher
     * @param getContinuationCommand Continuation command factory
     * @returns Updated continuation state
     */
    dispatch(soFar: DATA, continuationData: ToolsContinuationData, tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>, chatData: ChatDispatchData<CM>, getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>): Promise<DispatchData<DATA>>;
}
/**
 * Runs passed tools sequentially suspending continuation if suspended.
 * If any call fails - also fails other subsequent calls
 */
export declare class SequentialToolsContinuationDispatchRunner<DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ToolsContinuationDispatchRunner<DATA, CM> {
    private readonly dispatchers;
    private readonly formatContinuationError;
    private readonly logData;
    constructor(dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>, formatContinuationError?: (failed: ToolCallRequest, error: DispatchError) => DispatchError, logData?: boolean);
    dispatch(soFar: DATA, continuationData: ToolsContinuationData, tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>, chatData: ChatDispatchData<CM>, getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>): Promise<DispatchData<DATA>>;
    private getDispatcher;
}
export declare function commonFormatContinuationError(toolCall: ToolCallRequest): DispatchError;
