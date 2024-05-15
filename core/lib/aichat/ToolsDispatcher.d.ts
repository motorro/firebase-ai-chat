import { ChatData } from "./data/ChatState";
import { Continuation } from "./data/Continuation";
import { ContinuationCommand } from "./data/ContinuationCommand";
import { Meta } from "./data/Meta";
declare const SUCCESS: unique symbol;
declare const ERROR: unique symbol;
/**
 * Dispatch was successful
 */
export interface DispatchSuccess<out DATA extends ChatData> {
    readonly data: DATA;
    readonly comment?: string;
    readonly [SUCCESS]: typeof SUCCESS;
}
/**
 * Dispatch error. AI may interpret it
 */
export interface DispatchError {
    readonly error: string;
    readonly [ERROR]: typeof ERROR;
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
export declare function isDispatchResult<DATA extends ChatData>(data: unknown): data is DispatchResult<DATA>;
export type ToolDispatcherResult<DATA extends ChatData> = DATA | DispatchResult<DATA> | Continuation<DATA | DispatchResult<DATA>> | PromiseLike<DATA | DispatchResult<DATA> | Continuation<DATA | DispatchResult<DATA>>>;
/**
 * Represents a functions tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @param {ContinuationCommand} continuation - Command to dispatch when result is ready in case you want to suspend
 * @returns {PromiseLike<DispatchResult>} A promise that resolves with the result of the tool execution or suspension
 * @see {ToolsContinuation}
 */
export interface ToolsDispatcher<DATA extends ChatData, M extends Meta = Meta> {
    (data: DATA, name: string, args: Record<string, unknown>, continuation: ContinuationCommand<M>): ToolDispatcherResult<DATA>;
}
/**
 * Creates a success result
 * @param data Result data
 * @param comment Comment to supplement evaluated data
 * @returns Success result
 */
export declare function getDispatchSuccess<DATA extends ChatData>(data: DATA, comment?: string): DispatchSuccess<DATA>;
/**
 * Checks if `data` is `DispatchSuccess`
 * @param data Data to check
 * @return True if `data' is `DispatchSuccess`
 */
export declare function isDispatchSuccess<DATA extends ChatData>(data: unknown): data is DispatchSuccess<DATA>;
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
 * @param block
 */
export declare function dispatchToContinuation<DATA extends ChatData>(block: () => ToolDispatcherResult<DATA>): Promise<Continuation<DispatchResult<DATA>>>;
export {};
