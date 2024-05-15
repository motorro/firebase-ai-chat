import {ChatData} from "./ChatState";
import {DispatchResult} from "../ToolsDispatcher";
import {BoundChatCommand, ChatCommand} from "./ChatCommand";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {Meta} from "./Meta";

/**
 * Continuation request
 */
export interface ContinuationRequest<M extends Meta = Meta> {
    readonly continuationId: string
    readonly responseId: string,
    readonly continuationMeta: M
}

/**
 * Checks if data is a ContinuationRequest
 * @param data Data to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is ContinuationRequest
 */
export function isContinuationRequest<M extends Meta = Meta>(data: unknown, isMeta: (meta: Meta) => meta is M): data is ContinuationRequest<M> {
    return "object" === typeof data && null != data
        && "continuationId" in data && "string" === typeof data.continuationId
        && "responseId" in data && "string" === typeof data.responseId
        && "response" in data
        && "continuationMeta" in data && "object" == data.continuationMeta && isMeta(<Meta>data.continuationMeta)
}

/**
 * Continuation command
 */
export type ContinuationCommand<M extends Meta = Meta> = ChatCommand<ContinuationRequest<M>>

/**
 * Bound continuation command
 */
export type BoundContinuationCommand<M extends Meta = Meta> = BoundChatCommand<ContinuationRequest<M>>

/**
 * Checks if data is a ContinuationCommand
 * @param data Data to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is ContinuationCommand
 */
export function isContinuationCommand<M extends Meta = Meta>(data: unknown, isMeta: (meta: Meta) => meta is M): data is ContinuationCommand<M> {
    return "object" === typeof data && null !== data
        && "commonData" in data
        && "actionData" in data && isContinuationRequest(data.actionData, isMeta);
}

/**
 * Checks if data is a ContinuationCommand
 * @param req Queue request to check
 * @param isMeta Checks if continuation meta is of type M
 * @return True if data is BoundContinuationCommand request
 */
export function isContinuationCommandRequest<M extends Meta = Meta>(req: Request<unknown>, isMeta: (meta: Meta) => meta is M): req is Request<BoundContinuationCommand<M>> {
    return "object" === typeof req.data && null !== req.data
        && "queueName" in req.data && "string" === typeof req.data.queueName
        && "command" in req.data && isContinuationCommand(req.data.command, isMeta);
}

/**
 * Tool call request
 */
export interface ToolCallRequest<DATA extends ChatData> {
    /**
     * Tool call ID
     */
    toolCallId: string,
    /**
     * Data so far
     */
    soFar: DATA,
    /**
     * Tool (function) name
     */
    toolName: string,
    /**
     * Function arguments
     */
    args: Record<string, unknown>
}

/**
 * Tool call response
 */
export interface ToolCallResponse<DATA extends ChatData> {
    /**
     * Tool call ID
     */
    toolCallId: string,
    /**
     * Tool (function) name
     */
    toolName: string,
    /**
     * Tool call result
     */
    readonly response: DispatchResult<DATA>
}

export interface ToolCallsResult<DATA extends ChatData, M extends Meta = Meta> {
    readonly data: DATA
    readonly responses: ReadonlyArray<ToolCallResponse<DATA>>
    readonly meta: M
}

export interface ToolCall<DATA extends ChatData> {
    readonly request: ToolCallRequest<DATA>
    readonly response: DispatchResult<DATA> | null
}

export interface ToolsContinuationData<DATA extends ChatData, M extends Meta = Meta> {
    readonly dispatcherId: string
    readonly data: DATA
    readonly createdAt: Timestamp
    readonly updatedAt: Timestamp
    readonly meta: M
}

export interface ToolCallData<DATA extends ChatData> {
    readonly index: number
    readonly call: ToolCall<DATA>
}




