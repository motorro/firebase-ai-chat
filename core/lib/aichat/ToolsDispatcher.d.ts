import { ChatData } from "./data/ChatState";
import { Continuation } from "./data/Continuation";
import { ContinuationCommand } from "./data/ContinuationCommand";
import { ChatMeta } from "./data/Meta";
export interface ChatDispatchData<CM extends ChatMeta = ChatMeta> {
    readonly ownerId: string;
    readonly chatDocumentPath: string;
    readonly meta: CM | null;
}
/**
 * Function Dispatch was successful. Contains function result
 */
export interface FunctionSuccess {
    readonly result: Record<string, unknown>;
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
    readonly error: string;
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
export declare function isDispatchResult<DATA extends ChatData>(data: unknown): data is DispatchResult<DATA>;
/**
 * Tool dispatcher return value. May be:
 * - Some value. Wrapped to `FunctionSuccess` and returned to AI
 * - `DispatchResult` (`FunctionSuccess`, `ReducerSuccess`, `DispatchError' - this will be returned to AI tool
 * - Continuation of above
 */
export type ToolDispatcherReturnValue<DATA extends ChatData> = DATA | DispatchResult<DATA> | Continuation<DATA | DispatchResult<DATA>>;
/**
 * Represents a functions tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @param {ChatCommand} continuation - Command to dispatch when result is ready in case you want to suspend
 * @param {ChatCommandData} chatData - Chat data
 * @returns {PromiseLike<DispatchResult>} A promise that resolves with the result of the tool execution or suspension
 * @see ToolsContinuation
 */
export interface ToolsDispatcher<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    (data: DATA, name: string, args: Record<string, unknown>, continuation: ContinuationCommand<unknown>, chatData: ChatDispatchData<CM>): ToolDispatcherReturnValue<DATA> | PromiseLike<ToolDispatcherReturnValue<DATA>>;
}
/**
 * Creates a function success result
 * @param result Function return value
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
export declare function getFunctionSuccess(result: Record<string, unknown>, comment?: string): FunctionSuccess;
/**
 * Creates a reducer success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Reducer success result
 */
export declare function getReducerSuccess<DATA extends ChatData>(data: DATA, comment?: string): ReducerSuccess<DATA>;
/**
 * Checks if `data` is `ReducerSuccess`
 * @param data Data to check
 * @return True if `data' is `ReducerSuccess`
 */
export declare function isReducerSuccess<DATA extends ChatData>(data: unknown): data is ReducerSuccess<DATA>;
/**
 * Checks if `data` is `FunctionSuccess`
 * @param data Data to check
 * @return True if `data' is `FunctionSuccess`
 */
export declare function isFunctionSuccess(data: unknown): data is FunctionSuccess;
/**
 * Evaluates the error message from tools dispatcher
 * @param e {unknown} Error to analyze
 * @returns {DispatchError} Normalized dispatch error
 */
export declare function getDispatchError(e: unknown): DispatchError;
/**
 * Checks if `data` is `DispatchError`
 * @param data Data to check
 * @return True if `data' is `DispatchError`
 */
export declare function isDispatchError(data: unknown): data is DispatchError;
/**
 * Wraps dispatch to continuation
 * @param block Dispatching code
 */
export declare function dispatchToContinuation<DATA extends ChatData>(block: () => ToolDispatcherReturnValue<DATA> | PromiseLike<ToolDispatcherReturnValue<DATA>>): Promise<Continuation<DispatchResult<DATA>>>;
