/**
 * Chat command type
 */
export type ChatCommandType = "create" | "post" | "run" | "retrieve" | "close";
/**
 * Chat dispatch command
 */
export interface ChatCommand {
    readonly ownerId: string;
    readonly chatDocumentPath: string;
    readonly type: ChatCommandType;
    readonly dispatchId: string;
}
