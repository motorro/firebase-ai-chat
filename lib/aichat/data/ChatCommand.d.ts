import { ChatData, ChatState } from "./ChatState";
import { firestore } from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
export type ChatCommandType = "post" | "close";
export interface ChatCommand {
    readonly doc: DocumentReference<ChatState<ChatData>>;
    readonly type: ChatCommandType;
    readonly dispatchId: string;
}
export interface PostCommand extends ChatCommand {
    readonly type: "post";
}
export interface CloseCommand extends ChatCommand {
    readonly type: "close";
}
