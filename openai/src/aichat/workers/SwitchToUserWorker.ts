import {ChatData, ChatState, ChatWorker, DispatchControl} from "@motorro/firebase-ai-chat-core";
import {OpenAiAssistantConfig} from "../data/OpenAiAssistantConfig";
import {OpenAiChatAction, OpenAiChatActions} from "../data/OpenAiChatAction";
import {WorkerFactory} from "./WorkerFactory";
import {OpenAiQueueWorker} from "./OpenAiQueueWorker";
import {OpenAiChatCommand} from "../data/OpenAiChatCommand";

class SwitchToUserWorker extends OpenAiQueueWorker {
    async doDispatch(
        command: OpenAiChatCommand,
        _state: ChatState<OpenAiAssistantConfig, ChatData>,
        control: DispatchControl<OpenAiChatActions, OpenAiAssistantConfig, ChatData>
    ): Promise<void> {
        await this.continueQueue(control, command);
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
