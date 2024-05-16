import {ChatData, ToolCallResponse} from "@motorro/firebase-ai-chat-core";

export interface RunContinuationRequest<DATA extends ChatData> {
    readonly runId: string
    readonly toolsResult: ReadonlyArray<ToolCallResponse<DATA>>
}

