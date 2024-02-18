import {ChatConfig} from "./ChatConfig";
import {ChatStatus} from "./ChatStatus";
import * as admin from "firebase-admin";
import Timestamp = admin.firestore.Timestamp;

export interface ChatState<DATA extends object> {
    readonly userId: string,
    readonly config: ChatConfig
    readonly status: ChatStatus
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
