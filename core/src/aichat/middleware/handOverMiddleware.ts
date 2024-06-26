import {MessageMiddleware, PartialChatState} from "./MessageMiddleware";
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {ChatMeta, Meta} from "../data/Meta";
import {NewMessage} from "../data/NewMessage";
import {HandOverResult} from "../data/HandOverResult";
import {CommandScheduler} from "../CommandScheduler";
import {HandOverData, HandOverDelegate} from "../chat/handOver";

export interface HandOverControl<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    safeUpdate: (
        update: (
            tx: FirebaseFirestore.Transaction,
            updateState: (state: PartialChatState<DATA, CM>) => void,
            saveMessages: (messages: ReadonlyArray<NewMessage>) => void
        ) => Promise<void>
    ) => Promise<boolean>
    next: (messages: ReadonlyArray<NewMessage>) => Promise<void>,
    handOver: (data: HandOverData<WM, CM>) => Promise<HandOverResult>,
    handBack: (messages?: ReadonlyArray<NewMessage>, workerMeta?: WM | null) => Promise<HandOverResult>
}

export function handOverMiddleware<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta>(
    db: FirebaseFirestore.Firestore,
    schedulers: ReadonlyArray<CommandScheduler>,
    process: (
        messages: ReadonlyArray<NewMessage>,
        chatDocumentPath: string,
        chatState: ChatState<AssistantConfig, DATA, CM>,
        control: HandOverControl<DATA, WM, CM>
    ) => Promise<void>,
): MessageMiddleware<DATA, CM> {
    const handOver = new HandOverDelegate(db, schedulers);
    return async (messages, chatDocumentPath, chatState, control) => {
        const hoControl: HandOverControl<DATA, WM, CM> = {
            safeUpdate: control.safeUpdate,
            next: control.next,
            handOver: async (data: HandOverData<WM, CM>) => {
                return await db.runTransaction(async (tx) => {
                    return handOver.handOver(tx, chatDocumentPath, chatState, data);
                });
            },
            handBack: async (messages, workerMeta) => {
                return await db.runTransaction(async (tx) => {
                    return handOver.handBack(tx, chatDocumentPath, chatState, messages, workerMeta);
                });
            }
        };
        return process(messages, chatDocumentPath, chatState, hoControl);
    };
}
