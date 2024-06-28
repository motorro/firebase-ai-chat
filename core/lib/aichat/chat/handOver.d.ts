import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { CommandScheduler } from "../CommandScheduler";
import { firestore } from "firebase-admin";
import { ChatMeta, Meta } from "../data/Meta";
import DocumentReference = firestore.DocumentReference;
import { NewMessage } from "../data/NewMessage";
import { HandOverResult } from "../data/HandOverResult";
export interface HandOverData<WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    readonly config: AssistantConfig;
    readonly messages?: ReadonlyArray<NewMessage>;
    readonly chatMeta?: CM | null;
    readonly workerMeta?: WM | null;
}
export declare class HandOverDelegate {
    private readonly db;
    private readonly schedulers;
    constructor(db: FirebaseFirestore.Firestore, schedulers: ReadonlyArray<CommandScheduler>);
    handOver<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta>(tx: FirebaseFirestore.Transaction, chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, CM>> | string, chatState: ChatState<AssistantConfig, DATA, CM>, data: HandOverData<WM, CM>): Promise<HandOverResult>;
    handBack<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta>(tx: FirebaseFirestore.Transaction, chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, CM>> | string, chatState: ChatState<AssistantConfig, DATA, CM>, messages?: ReadonlyArray<NewMessage>, workerMeta?: WM | null): Promise<HandOverResult>;
}
