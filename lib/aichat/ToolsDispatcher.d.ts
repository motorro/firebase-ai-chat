import { ChatData } from "./data/ChatState";
/**
 * Represents a tools dispatcher that can execute different tools based on their names
 * @typedef {function} ToolsDispatcher
 * @param {string} name - The name of the tool to be executed
 * @param {Record<string, unknown>} args - The arguments to be passed to the tool
 * @returns {Promise<unknown>} A promise that resolves with the result of the tool execution
 */
export interface ToolsDispatcher<DATA extends ChatData> {
    (data: DATA, name: string, args: Record<string, unknown>): DATA | Promise<DATA>;
}
