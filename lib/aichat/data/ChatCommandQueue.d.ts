import { Meta } from "./Meta";
/**
 * Chat command type
 */
export type ChatCommandType = "create" | "post" | "run" | "switchToUserInput" | "retrieve" | "close";
/**
 * Common command data
 */
export interface ChatCommandData {
    readonly ownerId: string;
    readonly chatDocumentPath: string;
    readonly dispatchId: string;
    readonly meta: Meta | null;
}
/**
 * Chat dispatch command
 */
export interface ChatCommandQueue extends ChatCommandData {
    readonly actions: ReadonlyArray<ChatCommandType>;
}
