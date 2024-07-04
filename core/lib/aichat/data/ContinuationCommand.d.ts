import { ChatData } from "./ChatState";
import { DispatchResult } from "../ToolsDispatcher";
import { firestore } from "firebase-admin";
import Timestamp = firestore.Timestamp;
import { ChatCommand } from "./ChatCommand";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { HandBackAction, HandOverAction } from "./HandOverAction";
/**
 * Continuation request
 */
export interface ContinuationRequest {
    readonly continuationId: string;
    readonly tool: ContinuationRequestToolData;
}
/**
 * Dispatched tool data
 */
export interface ContinuationRequestToolData {
    readonly toolId: string;
}
export interface ContinuationCommand<A> extends ChatCommand<A> {
    continuation: ContinuationRequest;
}
/**
 * Checks if data is a ContinuationRequest
 * @param data Data to check
 * @return True if data is ContinuationRequest
 */
export declare function isContinuationRequest(data: unknown): data is ContinuationRequest;
/**
 * Checks if data is a ContinuationCommand
 * @param data Data to check
 * @return True if data is ContinuationCommand
 */
export declare function isContinuationCommand(data: unknown): data is ContinuationCommand<unknown>;
/**
 * Checks if data is a ContinuationCommand
 * @param req Queue request to check
 * @return True if data is ContinuationCommand request
 */
export declare function isContinuationCommandRequest(req: Request<unknown>): req is Request<ContinuationCommand<unknown>>;
/**
 * Tool call request
 */
export interface ToolCallRequest {
    /**
     * Tool call ID
     */
    toolCallId: string;
    /**
     * Tool (function) name
     */
    toolName: string;
    /**
     * Function arguments
     */
    args: Record<string, unknown>;
}
/**
 * Tool call response
 */
export interface ToolCallResponse<DATA extends ChatData> {
    /**
     * Tool call ID
     */
    toolCallId: string;
    /**
     * Tool (function) name
     */
    toolName: string;
    /**
     * Tool call result
     */
    readonly response: DispatchResult<DATA>;
}
export interface ToolCallsResult<DATA extends ChatData> {
    readonly data: DATA;
    readonly responses: ReadonlyArray<ToolCallResponse<DATA>>;
    readonly handOver: HandOverAction | HandBackAction | null;
}
export interface ToolCall<DATA extends ChatData> {
    readonly request: ToolCallRequest;
    readonly response: DispatchResult<DATA> | null;
}
export interface ToolsContinuationData {
    readonly dispatcherId: string;
    readonly state: "suspended" | "resolved";
    readonly handOver: HandOverAction | HandBackAction | null;
    readonly createdAt: Timestamp;
    readonly updatedAt: Timestamp;
}
export interface ToolCallData<DATA extends ChatData> {
    readonly index: number;
    readonly call: ToolCall<DATA>;
}
