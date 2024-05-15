import {ChatData} from "../data/ChatState";
import {
    DispatchResult,
    dispatchToContinuation,
    isDispatchSuccess,
    ToolsDispatcher
} from "../ToolsDispatcher";
import {
    ContinuationCommand,
    ToolCallData,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {logger} from "../../logging";
import {Continuation} from "../data/Continuation";
import {ChatError} from "../data/ChatError";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import {ChatCommandData} from "../data/ChatCommandData";

export interface DispatchData<DATA extends ChatData> {
    readonly data: DATA
    readonly tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>
}

export class ToolsContinuationDispatchRunner<DATA extends ChatData> {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    constructor(dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>) {
        this.dispatchers = dispatchers;
    }

    async dispatch(
        commonData: ChatCommandData,
        continuation: [DocumentReference<ToolsContinuationData<DATA>>, ToolsContinuationData<DATA>],
        tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>
    ): Promise<DispatchData<DATA>> {
        let [continuationDoc, continuationData] = continuation
        let suspended = false;
        let currentData = continuationData.data;
        const dispatchedTools: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];

        for (const [callId, callData] of tools) {
            if (suspended || null != callData.call.response) {
                pushResult(callId, callData);
                continue;
            }

            logger.d("Running tool:", callData.call.request.toolName);
            logger.d("Data so far:", currentData);
            logger.d("Arguments:", JSON.stringify(callData.call.request.args));

            const continuationCommand: ContinuationCommand = {
                commonData: commonData,
                actionData: {
                    continuationId: continuationDoc.id,
                    responseId: callId.id,
                    continuationMeta: continuationData.meta
                }
            }

            let result: Continuation<DispatchResult<DATA>> = await dispatchToContinuation(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(
                    currentData,
                    callData.call.request.toolName,
                    callData.call.request.args,
                    continuationCommand
                );
            });

            // Remove if running parallel
            if (result.isSuspended()) {
                logger.d("Suspended...");
                suspended = true;
                break;
            }
            pushResult(callId, {...callData, call: {...callData.call, response: result.value}});

            function pushResult(id: DocumentReference<ToolCallData<DATA>>, call: ToolCallData<DATA>) {
                dispatchedTools.push([callId, callData]);

                const response = callData.call.response;
                if (null != response && isDispatchSuccess(response)) {
                    currentData = response.data;
                }
            }
        }

        return {data: currentData, tools: dispatchedTools};
    }

    private getDispatcher(dispatcherId: string): ToolsDispatcher<DATA> {
        let dispatcher = this.dispatchers[dispatcherId] as ToolsDispatcher<DATA>;
        if (undefined === dispatcher) {
            logger.w("Dispatcher not found:", dispatcherId);
            throw new ChatError("unimplemented", true, "Dispatcher not found:", dispatcherId);
        }
        return dispatcher;
    }
}