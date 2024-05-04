import { ChatData } from "./data/ChatState";
/**
 * Dispatch was successful
 */
export interface DispatchSuccess<DATA extends ChatData> {
    data: DATA;
}
/**
 * Dispatch error. AI may interpret it
 */
export interface DispatchError {
    error: string;
}
/**
 * Function dispatch result
 */
export type DispatchResult<DATA extends ChatData> = DispatchSuccess<DATA> | DispatchError;
/**
 * Represents a functions tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @returns {Promise<DispatchResult>} A promise that resolves with the result of the tool execution
 */
export interface ToolsDispatcher<DATA extends ChatData> {
    (data: DATA, name: string, args: Record<string, unknown>): DATA | Promise<DATA>;
}
/**
 * Evaluates the error message from tools dispatcher
 * @param e {unknown} Error to analyze
 * @returns {DispatchError} Normalized dispatch error
 */
export declare function getDispatchError(e: unknown): DispatchError;
