import { OpenAiChatActions } from "./OpenAiChatAction";
import { ChatCommand, ContinuationCommand } from "@motorro/firebase-ai-chat-core";
import { engineId } from "../../engineId";
import { Request } from "firebase-functions/lib/common/providers/tasks";
export interface OpenAiChatCommand extends ChatCommand<OpenAiChatActions> {
    readonly engine: typeof engineId;
}
export declare function isOpenAiChatCommand(data: unknown): data is OpenAiChatCommand;
export declare function isOpenAiChatReq(req: Request<unknown>): req is Request<OpenAiChatCommand>;
export interface OpenAiContinuationMeta {
    readonly runId: string;
}
export declare function isOpenAiContinuationMeta(data: unknown): data is OpenAiContinuationMeta;
export interface OpenAiContinuationCommand extends OpenAiChatCommand, ContinuationCommand<OpenAiChatActions> {
    readonly meta: OpenAiContinuationMeta;
}
export declare function isOpenAiContinuationCommand(command: ChatCommand<unknown>): command is OpenAiContinuationCommand;
