import { VertexAiChatActions } from "./VertexAiChatAction";
import { ChatCommand, ContinuationCommand } from "@motorro/firebase-ai-chat-core";
import { engineId } from "../../engineId";
import { Request } from "firebase-functions/lib/common/providers/tasks";
export interface VertexAiChatCommand extends ChatCommand<VertexAiChatActions> {
    readonly engine: typeof engineId;
}
export declare function isVertexAiChatCommand(data: unknown): data is VertexAiChatCommand;
export declare function isVertexAiChatReq(req: Request<unknown>): req is Request<VertexAiChatCommand>;
export type VertexAiContinuationCommand = VertexAiChatCommand & ContinuationCommand<VertexAiChatActions>;
export declare function isVertexAiContinuationCommand(command: ChatCommand<unknown>): command is VertexAiContinuationCommand;
