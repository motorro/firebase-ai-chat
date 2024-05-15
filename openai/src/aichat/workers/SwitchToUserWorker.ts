import {ChatCommandData, ChatData, ChatState, ChatWorker, DispatchControl} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";

class SwitchToUserWorker extends OpenAiQueueWorker {

    async doDispatch(
        actions: OpenAiChatActions,
        _data: ChatCommandData,
        _state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        await this.continueQueue(control, actions);
    }
}

export class SwitchToUserFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction {
        return "switchToUserInput" === action;
    }
    create(): ChatWorker {
        return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
