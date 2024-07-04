import {ChatData} from "../data/ChatState";
import {
    ChatDispatchData,
    DispatchError,
    DispatchResult,
    dispatchToContinuation, isDispatchError, isFunctionSuccess,
    isReducerSuccess,
    ToolsDispatcher, ToolsHandOver
} from "../ToolsDispatcher";
import {
    ContinuationCommand,
    ContinuationRequestToolData,
    ToolCallData, ToolCallRequest,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {tagLogger} from "../../logging";
import {Continuation} from "../data/Continuation";
import {ChatError} from "../data/ChatError";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import {ChatMeta, Meta} from "../data/Meta";
import {HandBackAction, HandOverAction} from "../data/HandOverAction";
import {NewMessage} from "../data/NewMessage";
import {HandOverData} from "../chat/handOver";

const logger = tagLogger("ToolsContinuationDispatchRunner");

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
    /**
     * Hand-over action if any
     */
    readonly handOver: HandOverAction | HandBackAction | null
}

/**
 * Tools for dispatchers
 */
export interface ToolsContinuationDispatchRunnerTools {
    /**
     * Continuation command factory
     * @param toolCall Tool call
     * @return Created continuation command
     */
    readonly getContinuationCommand: (toolCall: ContinuationRequestToolData) => ContinuationCommand<unknown>
}

/**
 * Runs passed tools and manages continuation and call status
 */
export interface ToolsContinuationDispatchRunner<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    /**
     * Dispatches calls
     * @param soFar Current chat data
     * @param continuationData Current continuation data
     * @param tools Tool calls
     * @param chatData Chat data to provide to dispatcher
     * @param dispatchControl Tools dispatch control
     * @returns Updated continuation state
     */
    dispatch(
        soFar: DATA,
        continuationData: ToolsContinuationData,
        tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        chatData: ChatDispatchData<CM>,
        dispatchControl: ToolsContinuationDispatchRunnerTools
    ): Promise<DispatchData<DATA>>
}

/**
 * Runs passed tools sequentially suspending continuation if suspended.
 * If any call fails - also fails other subsequent calls
 */
// eslint-disable-next-line max-len
export class SequentialToolsContinuationDispatchRunner<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> implements ToolsContinuationDispatchRunner<DATA, WM, CM> {
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>;
    private readonly formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError;
    private readonly logData: boolean;

    constructor(
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        dispatchers: Readonly<Record<string, ToolsDispatcher<any, any, any>>>,
        formatContinuationError: (failed: ToolCallRequest, error: DispatchError) => DispatchError = commonFormatContinuationError,
        logData = false
    ) {
        this.dispatchers = dispatchers;
        this.formatContinuationError = formatContinuationError;
        this.logData = logData;
    }

    async dispatch(
        soFar: DATA,
        continuationData: ToolsContinuationData,
        tools: ReadonlyArray<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        chatData: ChatDispatchData<CM>,
        dispatchControl: ToolsContinuationDispatchRunnerTools
    ): Promise<DispatchData<DATA>> {
        let suspended = false;
        let failed: [ToolCallRequest, DispatchError] | null = null;
        let currentData = soFar;
        const dispatchedTools: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];
        let handOverAction: HandOverAction | HandBackAction | null = continuationData.handOver;

        function pushResult(id: DocumentReference<ToolCallData<DATA>>, call: ToolCallData<DATA>, response: DispatchResult<DATA> | null) {
            dispatchedTools.push([id, {...call, call: {...call.call, response: response}}]);
            if (null != response && isReducerSuccess(response)) {
                currentData = response.data;
            }
        }

        const handOver: ToolsHandOver = {
            handOver(data: HandOverData): void {
                handOverAction = {
                    name: "handOver",
                    config: data.config,
                    messages: data.messages,
                    chatMeta: data.chatMeta
                }
            },
            handBack(messages: ReadonlyArray<NewMessage> | undefined): void {
                handOverAction = {
                    name: "handBack",
                    messages: messages
                }
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
            if (this.logData) {
                tagLogger("DATA").d("Data so far:", currentData);
                tagLogger("DATA").d("Arguments:", JSON.stringify(callData.call.request.args));
            }

            const continuationCommand: ContinuationCommand<unknown> = dispatchControl.getContinuationCommand({toolId: callId.id});

            const result: Continuation<DispatchResult<DATA>> = await dispatchToContinuation(async () => {
                return this.getDispatcher(continuationData.dispatcherId)(
                    currentData,
                    callData.call.request.toolName,
                    callData.call.request.args,
                    continuationCommand,
                    chatData,
                    handOver
                );
            });

            let response: DispatchResult<DATA> | null = null;
            if (result.isResolved()) {
                logger.d("Resolved.");
                response = result.value;
                if (this.logData) {
                    if (isReducerSuccess(response)) {
                        tagLogger("DATA").d("Data after:", JSON.stringify(response.data));
                    }
                    if (isFunctionSuccess(response)) {
                        tagLogger("DATA").d("Result after:", JSON.stringify(response.result));
                    }
                }
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

        return {suspended: suspended, data: currentData, tools: dispatchedTools, handOver: handOverAction};
    }

    private getDispatcher(dispatcherId: string): ToolsDispatcher<DATA, WM, CM> {
        const dispatcher = this.dispatchers[dispatcherId] as ToolsDispatcher<DATA, WM, CM>;
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

