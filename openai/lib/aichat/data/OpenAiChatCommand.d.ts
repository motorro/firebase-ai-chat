import { OpenAiChatActions } from "./OpenAiChatAction";
import { ChatCommand, ContinuationCommand } from "@motorro/firebase-ai-chat-core";
import { RunContinuationMeta } from "./RunResponse";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { engineId } from "../../engineId";
export interface OpenAiChatCommand extends ChatCommand<OpenAiChatActions> {
    readonly engine: typeof engineId;
}
export type OpenAiContinuationCommand = ContinuationCommand<RunContinuationMeta>;
export declare function isOpenAiContinuationCommandRequest(req: Request<unknown>): req is Request<OpenAiContinuationCommand>;
