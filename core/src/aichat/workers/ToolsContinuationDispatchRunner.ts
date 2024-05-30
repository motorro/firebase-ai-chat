import {ChatData} from "../data/ChatState";
import {
    ChatDispatchData,
    DispatchError,
    DispatchResult,
    dispatchToContinuation, isDispatchError,
    isReducerSuccess,
    ToolsDispatcher
} from "../ToolsDispatcher";
import {
    ContinuationCommand,
    ContinuationRequestToolData,
    ToolCallData, ToolCallRequest,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {logger} from "../../logging";
import {Continuation} from "../data/Continuation";
import {ChatError} from "../data/ChatError";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import {ChatMeta} from "../data/Meta";

/**
 * Dispatch data
 */
export interface DispatchData<DATA extends ChatData> {
    /**
     * Dispatch was suspended if true - otherwise resolved
     */
    readonly suspended: boolean
    /**
     * Data state after dispatch
     */
    readonly data: DATA
    /**
     * Tools state after dispatch
     */
    readonly tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>
}

/**
 * Runs passed tools and manages continuation and call status
 */
export interface ToolsContinuationDispatchRunner<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
    /**
     * Dispatches calls
     * @param continuationData Current continuation data
     * @param tools Tool calls
     * @param chatData Chat data to provide to dispatcher
     * @param getContinuationCommand Continuation command factory
     * @returns Updated continuation state
     */
    dispatch(
        continuationData: ToolsContinuationData<DATA>,
        tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        chatData: ChatDispatchData<CM>,
        getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>
    ): Promise<DispatchData<DATA>>
}

/**
 * Runs passed tools sequentially suspending continuation if suspended
 * If any call fails - also fails other subsequent calls
 */
export class SequentialToolsContinuationDispatchRunner<DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ToolsContinuationDispatchRunner<DATA, CM> {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>;
    private readonly formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError;

    constructor(
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>,
        formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError = commonFormatContinuationError
    ) {
        this.dispatchers = dispatchers;
        this.formatContinuationError = formatContinuationError;
    }

    async dispatch(
        continuationData: ToolsContinuationData<DATA>,
        tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        chatData: ChatDispatchData<CM>,
        getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>
    ): Promise<DispatchData<DATA>> {
        let suspended = false;
        let failed: [ToolCallRequest, DispatchError] | null = null;
        let currentData = continuationData.data;
        const dispatchedTools: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];

        function pushResult(id: DocumentReference<ToolCallData<DATA>>, call: ToolCallData<DATA>, response: DispatchResult<DATA> | null) {
            dispatchedTools.push([id, {...call, call: {...call.call, response: response}}]);
            if (null != response && isReducerSuccess(response)) {
                currentData = response.data;
            }
        }

        for (const [callId, callData] of tools) {
            if (suspended || null !== callData.call.response) {
                pushResult(callId, callData, callData.call.response);
                if (isDispatchError(callData.call.response)) {
                    failed = [callData.call.request, callData.call.response];
                }
                continue;
            }

            if (null != failed) {
                pushResult(callId, callData, this.formatContinuationError(...failed));
                continue;
            }

            logger.d("Running tool:", callData.call.request.toolName);
            logger.d("Data so far:", currentData);
            logger.d("Arguments:", JSON.stringify(callData.call.request.args));

            const continuationCommand: ContinuationCommand<unknown> = getContinuationCommand({toolId: callId.id});

            const result: Continuation<DispatchResult<DATA>> = await dispatchToContinuation(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(
                    currentData,
                    callData.call.request.toolName,
                    callData.call.request.args,
                    continuationCommand,
                    chatData
                );
            });

            let response: DispatchResult<DATA> | null = null;
            if (result.isResolved()) {
                logger.d("Resolved.");
                response = result.value;
                if (isDispatchError(response)) {
                    logger.w("Dispatch error. Failing calls:", response.error);
                    failed = [callData.call.request, response];
                }
            } else {
                logger.d("Suspended...");
                suspended = true;
            }
            pushResult(callId, callData, response);
        }

        return {suspended: suspended, data: currentData, tools: dispatchedTools};
    }

    private getDispatcher(dispatcherId: string): ToolsDispatcher<DATA> {
        const dispatcher = this.dispatchers[dispatcherId] as ToolsDispatcher<DATA>;
        if (undefined === dispatcher) {
            logger.w("Dispatcher not found:", dispatcherId);
            throw new ChatError("unimplemented", true, "Dispatcher not found:", dispatcherId);
        }
        return dispatcher;
    }
}

export function commonFormatContinuationError(toolCall: ToolCallRequest): DispatchError {
    return {error: `Error had occurred while calling function: ${toolCall.toolName} before. Thus this function was not processed`};
}

