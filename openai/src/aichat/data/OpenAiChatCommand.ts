import {OpenAiChatActions} from "./OpenAiChatAction";
import {
    ChatCommand, ContinuationCommand,
    isChatCommand, isContinuationCommand
} from "@motorro/firebase-ai-chat-core";
import {engineId} from "../../engineId";

export interface OpenAiChatCommand extends ChatCommand<OpenAiChatActions> {
    readonly engine: typeof engineId
}

export function isOpenAiChatCommand(data: unknown): data is OpenAiChatCommand {
    return isChatCommand(data) && "engine" in data && engineId === data.engine;
}

export interface OpenAiContinuationMeta {
    readonly runId: string
}

export function isOpenAiContinuationMeta(data: unknown): data is OpenAiContinuationMeta {
    return "object" === typeof data && null !== data && "runId" in data && "string" === typeof data.runId;
}

export interface OpenAiContinuationCommand extends OpenAiChatCommand, ContinuationCommand<OpenAiChatActions> {
    readonly meta: OpenAiContinuationMeta
}

export function isOpenAiContinuationCommand(command: ChatCommand<unknown>): command is OpenAiContinuationCommand {
    return isContinuationCommand(command) && isOpenAiChatCommand(command)
        && "continueRun" === command.actionData[0]
        && "meta" in command && isOpenAiContinuationMeta(command.meta);
}
