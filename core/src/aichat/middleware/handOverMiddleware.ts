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
    handOver: (data: HandOverData<WM, CM>) => Promise<HandOverResult | undefined>,
    handBack: (messages?: ReadonlyArray<NewMessage>, workerMeta?: WM | null) => Promise<HandOverResult | undefined>
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
                let result: HandOverResult | undefined = undefined;
                await control.safeUpdate(async (tx) => {
                    result = await handOver.handOver(tx, chatDocumentPath, chatState, data);
                });
                return result;
            },
            handBack: async (messages, workerMeta) => {
                let result: HandOverResult | undefined = undefined;
                await control.safeUpdate(async (tx) => {
                    result = await handOver.handBack(tx, chatDocumentPath, chatState, messages, workerMeta);
                });
                return result;
            }
        };
        return process(messages, chatDocumentPath, chatState, hoControl);
    };
}
