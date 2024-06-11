import { ChatData } from "../data/ChatState";
import { ToolsContinuationDispatchRunner } from "./ToolsContinuationDispatchRunner";
import { ContinuationCommand, ContinuationRequest, ToolCallRequest, ToolCallsResult } from "../data/ContinuationCommand";
import { Continuation } from "../data/Continuation";
/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData> {
    /**
     * Dispatches tool calls
     * @param soFar Chat state so far
     * @param toolCalls Tool calls
     * @param updateChatData Function to update chat data
     * @param getContinuationCommand Continuation command factory
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(soFar: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, updateChatData: (data: DATA) => Promise<boolean>, getContinuationCommand: (continuationRequest: ContinuationRequest) => C): Promise<Continuation<ToolCallsResult<DATA>>>;
    /**
     * Dispatches next tool call
     * @param soFar Chat state so far
     * @param command Continuation command
     * @param updateChatData Function to update chat data
     * @param getContinuationCommand Continuation command factory
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatchCommand(soFar: DATA, command: C, updateChatData: (data: DATA) => Promise<boolean>, getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>): Promise<Continuation<ToolCallsResult<DATA>>>;
}
/**
 * Continuation dispatcher implementation
 */
export declare class ToolsContinuationDispatcherImpl<A, C extends ContinuationCommand<A>, DATA extends ChatData> implements ToolsContinuationDispatcher<A, C, DATA> {
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
    constructor(chatDocumentPath: string, dispatcherId: string, db: FirebaseFirestore.Firestore, dispatchRunner: ToolsContinuationDispatchRunner<DATA>, logData?: boolean);
    dispatch(soFar: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, updateChatData: (data: DATA) => Promise<boolean>, getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>): Promise<Continuation<ToolCallsResult<DATA>>>;
    dispatchCommand(soFar: DATA, command: C, updateChatData: (data: DATA) => Promise<boolean>, getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>): Promise<Continuation<ToolCallsResult<DATA>>>;
    private doDispatch;
    private getChatData;
}
