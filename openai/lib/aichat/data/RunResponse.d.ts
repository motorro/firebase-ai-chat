import { ChatData, Meta, ToolCallResponse } from "@motorro/firebase-ai-chat-core";
import { engineId } from "../../engineId";
export interface RunContinuationRequest<DATA extends ChatData> {
    readonly runId: string;
    readonly toolsResult: ReadonlyArray<ToolCallResponse<DATA>>;
}
export interface RunContinuationMeta extends Meta {
    readonly engine: typeof engineId;
    readonly runId: string;
}
export declare function isRunContinuationMeta(meta: unknown): meta is RunContinuationMeta;
