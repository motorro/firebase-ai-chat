import { ChatData, HandBackAction, HandOverAction, ToolCallResponse } from "@motorro/firebase-ai-chat-core";
export interface RunContinuationRequest<DATA extends ChatData> {
    readonly toolsResult: ReadonlyArray<ToolCallResponse<DATA>>;
    readonly handOver: HandOverAction | HandBackAction | null;
}
