import { ChatData } from "../data/ChatState";
import { ToolsDispatcher } from "../ToolsDispatcher";
import { ToolCallData, ToolsContinuationData } from "../data/ContinuationCommand";
import { firestore } from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import { ChatCommandData } from "../data/ChatCommandData";
export interface DispatchData<DATA extends ChatData> {
    readonly data: DATA;
    readonly tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>;
}
export declare class ToolsContinuationDispatchRunner<DATA extends ChatData> {
    private readonly dispatchers;
    constructor(dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>);
    dispatch(commonData: ChatCommandData, continuation: [DocumentReference<ToolsContinuationData<DATA>>, ToolsContinuationData<DATA>], tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>): Promise<DispatchData<DATA>>;
    private getDispatcher;
}
