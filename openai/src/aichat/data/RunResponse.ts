import {ChatData, Meta, ToolCallResponse} from "@motorro/firebase-ai-chat-core";
import {engineId} from "../../engineId";
import {OpenAiChatCommand} from "./OpenAiChatCommand";
import {OpenAiAssistantConfig} from "./OpenAiAssistantConfig";

export interface RunContinuationRequest<DATA extends ChatData> {
    readonly runId: string
    readonly toolsResult: ReadonlyArray<ToolCallResponse<DATA>>
}

export interface RunContinuationMeta extends Meta {
    readonly engine: typeof engineId
    readonly runId: string
    readonly config: OpenAiAssistantConfig
    readonly next: OpenAiChatCommand
}

export function isRunContinuationMeta(meta: unknown): meta is RunContinuationMeta {
    return "object" === typeof meta && null !== meta
        && "engine" in meta && engineId === meta.engine
        && "runId" in meta && "string" === meta.runId
        && "next" in meta && "object" === typeof meta.next;
}