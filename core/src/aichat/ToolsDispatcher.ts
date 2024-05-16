import {ChatData} from "./data/ChatState";
import {Continuation} from "./data/Continuation";
import {ContinuationCommand} from "./data/ContinuationCommand";

/**
 * Dispatch was successful
 */
export interface DispatchSuccess<out DATA extends ChatData> {
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
export type DispatchResult<DATA extends ChatData> = DispatchSuccess<DATA> | DispatchError;

/**
 * Checks if `data` is `DispatchResult`
 * @param data Data to check
 * @return True if `data' is `DispatchResult`
 */
export function isDispatchResult<DATA extends ChatData>(data: unknown): data is DispatchResult<DATA> {
    return isDispatchSuccess(data) || isDispatchError(data);
}

export type ToolDispatcherResult<DATA extends ChatData> = DATA
    | DispatchResult<DATA>
    | Continuation<DATA | DispatchResult<DATA>>
    | PromiseLike<DATA | DispatchResult<DATA> | Continuation<DATA | DispatchResult<DATA>>>;

/**
 * Represents a functions tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @param {ChatCommand} continuation - Command to dispatch when result is ready in case you want to suspend
 * @returns {PromiseLike<DispatchResult>} A promise that resolves with the result of the tool execution or suspension
 * @see ToolsContinuation
 */
export interface ToolsDispatcher<DATA extends ChatData> {
    (data: DATA, name: string, args: Record<string, unknown>, continuation: ContinuationCommand<unknown>): ToolDispatcherResult<DATA>
}

/**
 * Creates a success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Success result
 */
export function getDispatchSuccess<DATA extends ChatData>(data: DATA, comment?:string): DispatchSuccess<DATA> {
    return {
        data: data,
        ...(undefined !== comment ? {comment: comment} : {})
    };
}

/**
 * Checks if `data` is `DispatchSuccess`
 * @param data Data to check
 * @return True if `data' is `DispatchSuccess`
 */
export function isDispatchSuccess<DATA extends ChatData>(data: unknown): data is DispatchSuccess<DATA> {
    return "object" === typeof data && null !== data && "data" in data && "object" === typeof data.data && null !== data.data;
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
export async function dispatchToContinuation<DATA extends ChatData>(block: () => ToolDispatcherResult<DATA>): Promise<Continuation<DispatchResult<DATA>>> {
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
            return Continuation.resolve(getDispatchSuccess(<DATA>value));
        }
    }
}

