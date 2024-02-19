import {ChatConfig} from "./ChatConfig";
import {ChatStatus} from "./ChatStatus";
import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;

export type ChatData = Record<string, unknown>;

export interface ChatState<out DATA extends ChatData> {
    readonly userId: string,
    readonly config: ChatConfig
    readonly status: ChatStatus
    readonly dispatchId?: string
    readonly data: DATA,
    readonly lastMessageId?: string
    readonly createdAt: Timestamp,
    readonly updatedAt: Timestamp
}

export interface ChatStateUpdate<DATA> {
    status: ChatStatus,
    data: DATA
    readonly lastMessageId?: string
}
