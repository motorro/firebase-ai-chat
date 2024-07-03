import {BaseChatWorker} from "./BaseChatWorker";
import {ChatAction, ChatCommand} from "../data/ChatCommand";
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {ChatMeta} from "../data/Meta";
import {TaskScheduler} from "../TaskScheduler";
import {ChatCleaner} from "./ChatCleaner";
import {Request} from "firebase-functions/lib/common/providers/tasks";
import {DispatchControl} from "./ChatWorker";
import {CommandScheduler} from "../CommandScheduler";
import {HandOverDelegate} from "../chat/handOver";
import {HandOverAction, isHandBackAction, isHandOverAction} from "../data/HandOverAction";

export class HandOverWorker<DATA extends ChatData, CM extends ChatMeta = ChatMeta> extends BaseChatWorker<ChatAction, AssistantConfig, DATA, CM> {
    private readonly handOver: HandOverDelegate

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        cleaner: ChatCleaner,
        logData: boolean,
        schedulers: ReadonlyArray<CommandScheduler>
    ) {
        super(firestore, scheduler, cleaner, logData);
        this.handOver = new HandOverDelegate(firestore, schedulers);
    }

    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<unknown>> {
        return isHandOverAction(req.data.actionData);
    }

    protected async doDispatch(command: ChatCommand<ChatAction>, state: ChatState<AssistantConfig, DATA, CM>, control: DispatchControl<DATA, CM>): Promise<void> {
        const hoAction = <HandOverAction>(command.actionData);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handOver(tx, command.commonData.chatDocumentPath, state, {
                config: hoAction.config,
                messages: hoAction.messages,
                chatMeta: hoAction.chatMeta,
                workerMeta: command.commonData.meta
            });
        });
    }
}

export class HandBackWorker<DATA extends ChatData, CM extends ChatMeta = ChatMeta> extends BaseChatWorker<ChatAction, AssistantConfig, DATA, CM> {
    private readonly handOver: HandOverDelegate

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        cleaner: ChatCleaner,
        logData: boolean,
        schedulers: ReadonlyArray<CommandScheduler>
    ) {
        super(firestore, scheduler, cleaner, logData);
        this.handOver = new HandOverDelegate(firestore, schedulers);
    }

    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<unknown>> {
        return isHandBackAction(req.data.actionData);
    }

    protected async doDispatch(command: ChatCommand<unknown>, state: ChatState<AssistantConfig, DATA, CM>, control: DispatchControl<DATA, CM>): Promise<void> {
        const hbAction = <HandOverAction>(command.actionData);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handBack(
                tx,
                command.commonData.chatDocumentPath,
                state,
                hbAction.messages,
                command.commonData.meta
            );
        });
    }
}