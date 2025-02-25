import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {
    ChatCleaner, ChatData, ChatState,
    CommandScheduler, DispatchControl, HandOverAction,
    HandOverDelegate, isHandBackAction,
    isHandOverAction,
    TaskScheduler
} from "@motorro/firebase-ai-chat-core";
import {AiWrapper} from "../AiWrapper";
import {OpenAiChatAction} from "../data/OpenAiChatAction";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";

export class HandOverWorker extends OpenAiQueueWorker {
    private readonly handOver: HandOverDelegate;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        cleaner: ChatCleaner,
        logData: boolean,
        schedulers: ReadonlyArray<CommandScheduler>
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.handOver = new HandOverDelegate(firestore, schedulers);
    }

    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isHandOverAction(action);
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        const hoAction = <HandOverAction>(command.actionData[0]);
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

export class HandBackWorker extends OpenAiQueueWorker {
    private readonly handOver: HandOverDelegate;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        wrapper: AiWrapper,
        cleaner: ChatCleaner,
        logData: boolean,
        schedulers: ReadonlyArray<CommandScheduler>
    ) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.handOver = new HandOverDelegate(firestore, schedulers);
    }

    static isSupportedAction(action: unknown): action is OpenAiChatAction {
        return isHandBackAction(action);
    }

    async doDispatch(
        command: OpenAiChatCommand,
        state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<ChatData>
    ): Promise<void> {
        const hoAction = <HandOverAction>(command.actionData[0]);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handBack(
                tx,
                command.commonData.chatDocumentPath,
                state,
                hoAction.messages,
                command.commonData.meta
            );
        });
    }
}
