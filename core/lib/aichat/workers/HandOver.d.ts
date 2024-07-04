import { BaseChatWorker } from "./BaseChatWorker";
import { ChatAction, ChatCommand } from "../data/ChatCommand";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { ChatMeta } from "../data/Meta";
import { TaskScheduler } from "../TaskScheduler";
import { ChatCleaner } from "./ChatCleaner";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { DispatchControl } from "./ChatWorker";
import { CommandScheduler } from "../CommandScheduler";
export declare class HandOverWorker<DATA extends ChatData, CM extends ChatMeta = ChatMeta> extends BaseChatWorker<ChatAction, AssistantConfig, DATA, CM> {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<unknown>>;
    protected doDispatch(command: ChatCommand<ChatAction>, state: ChatState<AssistantConfig, DATA, CM>, control: DispatchControl<DATA, CM>): Promise<void>;
}
export declare class HandBackWorker<DATA extends ChatData, CM extends ChatMeta = ChatMeta> extends BaseChatWorker<ChatAction, AssistantConfig, DATA, CM> {
    private readonly handOver;
    constructor(firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, cleaner: ChatCleaner, logData: boolean, schedulers: ReadonlyArray<CommandScheduler>);
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<unknown>>;
    protected doDispatch(command: ChatCommand<unknown>, state: ChatState<AssistantConfig, DATA, CM>, control: DispatchControl<DATA, CM>): Promise<void>;
}
