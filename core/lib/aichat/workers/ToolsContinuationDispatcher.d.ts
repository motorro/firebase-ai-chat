import { ChatData } from "../data/ChatState";
import { ToolsContinuationDispatchRunner } from "./ToolsContinuationDispatchRunner";
import { ContinuationCommand, ContinuationRequest, ToolCallRequest, ToolCallsResult } from "../data/ContinuationCommand";
import { Continuation } from "../data/Continuation";
import { ChatMeta } from "../data/Meta";
import { HandBackAction, HandOverAction } from "../data/HandOverAction";
/**
 * Tools for dispatchers
 */
export interface ToolsContinuationDispatcherTools {
    /**
     * Continuation command factory
     * @param continuationRequest Continuation request
     * @return Created continuation command
     */
    readonly getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>;
}
export type ToolContinuationSoFar<DATA extends ChatData> = DATA | {
    readonly data: DATA;
    readonly handOver: HandOverAction | HandBackAction | null;
};
export declare function hasHandOver<DATA extends ChatData>(data: ToolContinuationSoFar<DATA>): data is {
    readonly data: DATA;
    readonly handOver: HandOverAction | HandBackAction | null;
};
/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<DATA extends ChatData> {
    /**
     * Dispatches tool calls
     * @param soFar Dispatch data so far
     * @param toolCalls Tool calls
     * @param updateChatData Function to update chat data
     * @param dispatchControl Tools dispatch control
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(soFar: ToolContinuationSoFar<DATA>, toolCalls: ReadonlyArray<ToolCallRequest>, updateChatData: (data: DATA) => Promise<DATA>, dispatchControl: ToolsContinuationDispatcherTools): Promise<Continuation<ToolCallsResult<DATA>>>;
    /**
     * Dispatches next tool call
     * @param soFar Dispatch data so far
     * @param command Continuation command
     * @param updateChatData Function to update chat data
     * @param dispatchControl Tools dispatch control
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatchCommand(soFar: DATA, command: ContinuationCommand<unknown>, updateChatData: (data: DATA) => Promise<DATA>, dispatchControl: ToolsContinuationDispatcherTools): Promise<Continuation<ToolCallsResult<DATA>>>;
}
/**
 * Continuation dispatcher implementation
 */
export declare class ToolsContinuationDispatcherImpl<DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ToolsContinuationDispatcher<DATA> {
    private readonly dispatcherId;
    private readonly chatDocument;
    private readonly db;
    private readonly dispatchRunner;
    private readonly logData;
    /**
     * Constructor
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @param logData If true - logs data state
     * and thus fails continuation
     */
    constructor(chatDocumentPath: string, dispatcherId: string, db: FirebaseFirestore.Firestore, dispatchRunner: ToolsContinuationDispatchRunner<DATA, CM>, logData?: boolean);
    dispatch(soFar: ToolContinuationSoFar<DATA>, toolCalls: ReadonlyArray<ToolCallRequest>, updateChatData: (data: DATA) => Promise<DATA>, dispatchControl: ToolsContinuationDispatcherTools): Promise<Continuation<ToolCallsResult<DATA>>>;
    dispatchCommand(soFar: DATA, command: ContinuationCommand<unknown>, updateChatData: (data: DATA) => Promise<DATA>, dispatchControl: ToolsContinuationDispatcherTools): Promise<Continuation<ToolCallsResult<DATA>>>;
    private doDispatch;
    private getChatData;
}
