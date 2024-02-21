export type ChatCommandType = "post" | "close";

export interface ChatCommand {
    readonly ownerId: string
    readonly chatDocumentPath: string
    readonly type: ChatCommandType
    readonly dispatchId: string
}

export interface PostCommand extends ChatCommand {
    readonly type: "post"
}

export interface CloseCommand extends ChatCommand {
    readonly type: "close"
}
