import {VertexAiChatActions} from "./VertexAiChatAction";
import {ChatCommand, ContinuationCommand, isContinuationCommand} from "@motorro/firebase-ai-chat-core";
import {engineId} from "../../engineId";
import {Request} from "firebase-functions/lib/common/providers/tasks";

export interface VertexAiChatCommand extends ChatCommand<VertexAiChatActions> {
    readonly engine: typeof engineId
}

export function isVertexAiChatCommand(data: unknown): data is VertexAiChatCommand {
    return "object" === typeof data && null !== data && "engine" in data && engineId === data.engine;
}

export function isVertexAiChatReq(req: Request<unknown>): req is Request<VertexAiChatCommand> {
    return isVertexAiChatCommand(req.data);
}

export type VertexAiContinuationCommand = VertexAiChatCommand & ContinuationCommand<VertexAiChatActions>

export function isVertexAiContinuationCommand(command: ChatCommand<unknown>): command is VertexAiContinuationCommand {
    return isContinuationCommand(command) && isVertexAiChatCommand(command) && "continuePost" === command.actionData[0];
}
