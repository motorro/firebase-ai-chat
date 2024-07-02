import { BaseChatWorker } from "./BaseChatWorker";
import { ChatAction, ChatCommand } from "../data/ChatCommand";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatMeta } from "../data/Meta";
import { DispatchControl } from "./ChatWorker";
export declare class SchedulingWorker extends BaseChatWorker<ChatAction, AssistantConfig, ChatData> {
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<unknown>>;
    protected doDispatch(command: ChatCommand<unknown>, state: ChatState<AssistantConfig, ChatData, ChatMeta>, control: DispatchControl<ChatData, ChatMeta>): Promise<void>;
}
