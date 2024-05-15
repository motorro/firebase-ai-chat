import { BaseChatWorker } from "./BaseChatWorker";
import { AssistantConfig, ChatData, ChatState } from "../data/ChatState";
import { Meta } from "../data/Meta";
import { ContinuationRequest, ToolCallsResult } from "../data/ContinuationCommand";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand } from "../data/ChatCommand";
import { ChatCommandData } from "../data/ChatCommandData";
import { TaskScheduler } from "../TaskScheduler";
import { ToolsContinuationDispatchRunner } from "./ToolsContinuationDispatchRunner";
import { DispatchControl } from "./ChatWorker";
export declare class ToolContinuationWorker<AC extends AssistantConfig, DATA extends ChatData, M extends Meta> extends BaseChatWorker<ContinuationRequest<M>, AC, DATA> {
    private readonly isSupportedMeta;
    private readonly dispatchRunner;
    private readonly onResolved;
    constructor(isSupportedMeta: (meta: Meta) => meta is M, onResolved: (data: ChatCommandData, result: ToolCallsResult<DATA, M>, updateChatState: (state: Partial<ChatState<AC, DATA>>) => Promise<boolean>) => Promise<void>, firestore: FirebaseFirestore.Firestore, scheduler: TaskScheduler, dispatchRunner: ToolsContinuationDispatchRunner<DATA>);
    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<ContinuationRequest<M>>>;
    protected doDispatch(action: ContinuationRequest<M>, data: ChatCommandData, _state: ChatState<AC, DATA, Readonly<Record<string, unknown>>>, control: DispatchControl<ContinuationRequest<M>, AC, DATA>): Promise<void>;
}
