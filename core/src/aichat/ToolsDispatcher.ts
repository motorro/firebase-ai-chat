import {AssistantConfig, ChatData} from "./data/ChatState";
import {Continuation} from "./data/Continuation";
import {ContinuationCommand} from "./data/ContinuationCommand";
import {ChatMeta, Meta} from "./data/Meta";
import {HandOverData} from "./chat/handOver";
import {NewMessage} from "./data/NewMessage";

export interface ChatDispatchData<CM extends ChatMeta = ChatMeta> {
    readonly ownerId: string
    readonly chatDocumentPath: string,
    readonly dispatchId: string,
    readonly sessionId: string | null,
    readonly assistantConfig: AssistantConfig,
    readonly meta: CM | null
}

/**
 * Some arbitrary data to return from function
 */
export type FunctionSuccessResult = Record<string, unknown> | Record<string, unknown>[] | null

/**
 * Function Dispatch was successful. Contains function result
 */
export interface FunctionSuccess {
    readonly result: FunctionSuccessResult;
    readonly comment?: string;
}

/**
 * Reducer Dispatch was successful. Contains changed data state
 */
export interface ReducerSuccess<out DATA extends ChatData> {
    readonly data: DATA;
    readonly comment?: string;
}

/**
 * Dispatch error. AI may interpret it
 */
export interface DispatchError {
    readonly error: string
}

/**
 * Function dispatch result
 */
export type DispatchResult<DATA extends ChatData> = FunctionSuccess | ReducerSuccess<DATA> | DispatchError;

/**
 * Checks if `data` is `DispatchResult`
 * @param data Data to check
 * @return True if `data' is `DispatchResult`
 */
export function isDispatchResult<DATA extends ChatData>(data: unknown): data is DispatchResult<DATA> {
    return isReducerSuccess(data) || isFunctionSuccess(data) || isDispatchError(data);
}

/**
 * Tool dispatcher return value. May be:
 * - Some value. Wrapped to `FunctionSuccess` and returned to AI
 * - `DispatchResult` (`FunctionSuccess`, `ReducerSuccess`, `DispatchError' - this will be returned to AI tool
 * - Continuation of above
 */
export type ToolDispatcherReturnValue<DATA extends ChatData> = DATA | DispatchResult<DATA> | Continuation<DATA | DispatchResult<DATA>>;

/**
 * Hand-over for tools
 */
export interface ToolsHandOver<WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    /**
     * Does the hand-over
     * @param data Hand-over data
     */
    handOver: (data: HandOverData<WM, CM>) => void
    /**
     * Does the hand-back
     * @param messages Hand-over messages
     */
    handBack: (messages?: ReadonlyArray<NewMessage>) => void
}

/**
 * Represents a functions tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @param {ChatCommand} continuation - Command to dispatch when result is ready in case you want to suspend
 * @param {ChatCommandData} chatData - Chat data
 * @param {ToolsHandOver} Hand-over control
 * @returns {PromiseLike<DispatchResult>} A promise that resolves with the result of the tool execution or suspension
 * @see ToolsContinuation
 */
export interface ToolsDispatcher<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    (
        data: DATA,
        name: string,
        args: Record<string, unknown>,
        continuation: ContinuationCommand<unknown>,
        chatData: ChatDispatchData<CM>,
        handOver: ToolsHandOver<WM, CM>
    ): ToolDispatcherReturnValue<DATA> | PromiseLike<ToolDispatcherReturnValue<DATA>>
}

/**
 * Creates a function success result
 * @param result Function return value
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
export function getFunctionSuccess(result: FunctionSuccessResult, comment?:string): FunctionSuccess {
    return {
        result: result,
        ...(undefined !== comment ? {comment: comment} : {})
    };
}

/**
 * Creates a reducer success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
export function getReducerSuccess<DATA extends ChatData>(data: DATA, comment?:string): ReducerSuccess<DATA> {
    return {
        data: data,
        ...(undefined !== comment ? {comment: comment} : {})
    };
}

/**
 * Checks if `data` is `ReducerSuccess`
 * @param data Data to check
 * @return True if `data' is `ReducerSuccess`
 */
export function isReducerSuccess<DATA extends ChatData>(data: unknown): data is ReducerSuccess<DATA> {
    return "object" === typeof data && null !== data && "data" in data && "object" === typeof data.data && null !== data.data;
}

/**
 * Checks if `data` is `FunctionSuccess`
 * @param data Data to check
 * @return True if `data' is `FunctionSuccess`
 */
export function isFunctionSuccess(data: unknown): data is FunctionSuccess {
    return "object" === typeof data && null !== data && "result" in data && "object" === typeof data.result;
}

/**
 * Evaluates the error message from tools dispatcher
 * @param e {unknown} Error to analyze
 * @returns {DispatchError} Normalized dispatch error
 */
export function getDispatchError(e: unknown): DispatchError {
    if (isDispatchError(e)) {
        return e;
    }
    if ("string" === typeof e) {
        return {
            error: e
        };
    }
    if ("object" === typeof e && null !== e) {
        if ("error" in e && "string" === typeof e.error) {
            return {
                error: e.error
            };
        }
        if ("message" in e && "string" === typeof e.message) {
            return {
                error: e.message
            };
        }
        return {
            error: e.toString()
        };
    }
    return {
        error: "Unknown error"
    };
}

/**
 * Checks if `data` is `DispatchError`
 * @param data Data to check
 * @return True if `data' is `DispatchError`
 */
export function isDispatchError(data: unknown): data is DispatchError {
    return "object" === typeof data && null !== data && "error" in data && "string" === typeof data.error;
}

/**
 * Wraps dispatch to continuation
 * @param block Dispatching code
 */
export async function dispatchToContinuation<DATA extends ChatData>(
    block: () => ToolDispatcherReturnValue<DATA> | PromiseLike<ToolDispatcherReturnValue<DATA>>
): Promise<Continuation<DispatchResult<DATA>>> {
    try {
        const result = await block();
        if (Continuation.isContinuation(result)) {
            return result.isResolved() ? wrapToDispatchResult(result.value) : <Continuation<DispatchResult<DATA>>>result;
        }
        return wrapToDispatchResult(result);
    } catch (e) {
        return wrapToDispatchResult(getDispatchError(e));
    }

    function wrapToDispatchResult(value: DATA | DispatchResult<DATA>): Continuation<DispatchResult<DATA>> {
        if (isDispatchResult(value)) {
            return Continuation.resolve(value);
        } else {
            return Continuation.resolve(getFunctionSuccess(<DATA>value));
        }
    }
}

