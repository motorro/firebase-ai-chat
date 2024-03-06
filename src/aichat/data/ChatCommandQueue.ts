/**
 * Chat command type
 */
export type ChatCommandType = "create" | "post" | "run" | "retrieve" | "close";

/**
 * Common command data
 */
export interface ChatCommandData {
    readonly ownerId: string
    readonly chatDocumentPath: string
    readonly dispatchId: string
}

/**
 * Chat dispatch command
 */
export interface ChatCommandQueue extends ChatCommandData{
    readonly actions: ReadonlyArray<ChatCommandType>
}