import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {ToolsContinuationDispatchRunner} from "./ToolsContinuationDispatchRunner";
import {
    ContinuationCommand,
    ContinuationRequest,
    ToolCallData,
    ToolCallRequest,
    ToolCallResponse,
    ToolCallsResult,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {Continuation} from "../data/Continuation";
import {tagLogger} from "../../logging";
import {Collections} from "../data/Collections";
import {firestore} from "firebase-admin";
import {ChatError} from "../data/ChatError";
import {ChatDispatchData} from "../ToolsDispatcher";
import {ChatMeta} from "../data/Meta";
import DocumentReference = firestore.DocumentReference;
import Timestamp = firestore.Timestamp;
import CollectionReference = firestore.CollectionReference;
import FieldValue = firestore.FieldValue;
import {HandBackAction, HandOverAction} from "../data/HandOverAction";

const logger = tagLogger("ToolsContinuationDispatcher");

/**
 * Tools for dispatchers
 */
export interface ToolsContinuationDispatcherTools {
    /**
     * Continuation command factory
     * @param continuationRequest Continuation request
     * @return Created continuation command
     */
    readonly getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>
}

export type ToolContinuationSoFar<DATA extends ChatData> = DATA | {
    readonly data: DATA
    readonly handOver: HandOverAction | HandBackAction | null
};

export function hasHandOver<DATA extends ChatData>(data: ToolContinuationSoFar<DATA>): data is {
    readonly data: DATA
    readonly handOver: HandOverAction | HandBackAction | null
} {
    return "data" in data && "handOver" in data;
}

/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<DATA extends ChatData> {
    /**
     * Dispatches tool calls
     * @param soFar Dispatch data so far
     * @param toolCalls Tool calls
     * @param updateChatData Function to update chat data
     * @param dispatchControl Tools dispatch control
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(
        soFar: ToolContinuationSoFar<DATA>,
        toolCalls: ReadonlyArray<ToolCallRequest>,
        updateChatData: (data: DATA) => Promise<DATA>,
        dispatchControl: ToolsContinuationDispatcherTools
    ): Promise<Continuation<ToolCallsResult<DATA>>>

    /**
     * Dispatches next tool call
     * @param soFar Dispatch data so far
     * @param command Continuation command
     * @param updateChatData Function to update chat data
     * @param dispatchControl Tools dispatch control
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatchCommand(
        soFar: DATA,
        command: ContinuationCommand<unknown>,
        updateChatData: (data: DATA) => Promise<DATA>,
        dispatchControl: ToolsContinuationDispatcherTools
    ): Promise<Continuation<ToolCallsResult<DATA>>>
}

/**
 * Continuation dispatcher implementation
 */
export class ToolsContinuationDispatcherImpl<DATA extends ChatData, CM extends ChatMeta = ChatMeta> implements ToolsContinuationDispatcher<DATA> {
    private readonly dispatcherId: string;
    private readonly chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, CM>>;
    private readonly db: FirebaseFirestore.Firestore;
    private readonly dispatchRunner: ToolsContinuationDispatchRunner<DATA>;
    private readonly logData: boolean;

    /**
     * Constructor
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @param logData If true - logs data state
     * and thus fails continuation
     */
    constructor(
        chatDocumentPath: string,
        dispatcherId: string,
        db: FirebaseFirestore.Firestore,
        dispatchRunner: ToolsContinuationDispatchRunner<DATA, CM>,
        logData = false
    ) {
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, DATA, CM>>;
        this.db = db;
        this.dispatchRunner = dispatchRunner;
        this.logData = logData;
    }

    async dispatch(
        soFar: ToolContinuationSoFar<DATA>,
        toolCalls: ReadonlyArray<ToolCallRequest>,
        updateChatData: (data: DATA) => Promise<DATA>,
        dispatchControl: ToolsContinuationDispatcherTools
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        logger.d("Dispatching tool calls");
        if (this.logData) {
            tagLogger("DATA").d("Data so far: ", JSON.stringify(soFar));
        }
        const continuationDocument = this.chatDocument.collection(Collections.continuations).doc() as DocumentReference<ToolsContinuationData>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation: ToolsContinuationData = {
            dispatcherId: this.dispatcherId,
            state: "suspended",
            handOver: hasHandOver(soFar) ? soFar.handOver : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const tools: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];
        const batch = this.db.batch();

        // Pre-set data as doDispatch merges updates
        batch.set(continuationDocument, continuation);
        toolCalls.forEach((it, index) => {
            const doc = toolCallsCollection.doc();
            const tool = {index: index, call: {request: it, response: null}};
            tools.push([doc, tool]);
            batch.set(doc, tool);
        });

        const result = await this.doDispatch(
            batch,
            updateChatData,
            continuationDocument,
            hasHandOver(soFar) ? soFar.data : soFar,
            continuation,
            tools,
            dispatchControl
        );

        // Save only if suspended
        if (result.isSuspended()) {
            logger.d("Saving continuation to:", continuationDocument.path);
            await batch.commit();
        }

        return result;
    }

    async dispatchCommand(
        soFar: DATA,
        command: ContinuationCommand<unknown>,
        updateChatData: (data: DATA) => Promise<DATA>,
        dispatchControl: ToolsContinuationDispatcherTools
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        logger.d("Continuation processing. Moving forward:", JSON.stringify(command));
        if (this.logData) {
            tagLogger("DATA").d("Data so far: ", JSON.stringify(soFar));
        }
        // eslint-disable-next-line max-len
        const continuationDocument = this.chatDocument.collection(Collections.continuations).doc(command.continuation.continuationId) as DocumentReference<ToolsContinuationData>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError("not-found", true, "Continuation data not found"));
        }

        const toolCallData = (await toolCallsCollection.orderBy("index").get()).docs;
        const toolCalls: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];
        toolCallData.forEach((it) => {
            const data = it.data();
            if (undefined !== data) {
                toolCalls.push([it.ref, data]);
            }
        });

        const batch = this.db.batch();
        const result = await this.doDispatch(
            batch,
            updateChatData,
            continuationDocument,
            soFar,
            continuation,
            toolCalls,
            dispatchControl
        );
        logger.d("Saving continuation to:", continuationDocument.path);
        await batch.commit();
        return result;
    }

    private async doDispatch(
        batch: FirebaseFirestore.WriteBatch,
        updateChatData: (data: DATA) => Promise<DATA>,
        continuationDoc: DocumentReference<ToolsContinuationData>,
        soFar: DATA,
        continuation: ToolsContinuationData,
        toolCalls: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        dispatchControl: ToolsContinuationDispatcherTools
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        const dispatched = await this.dispatchRunner.dispatch(
            soFar,
            continuation,
            toolCalls,
            await this.getChatData(),
            {
                getContinuationCommand: (continuationToolCall) => dispatchControl.getContinuationCommand({
                    continuationId: continuationDoc.id,
                    tool: continuationToolCall
                })
            }
        );

        const result: Array<ToolCallResponse<DATA>> = [];
        for (let i = 0; i < dispatched.tools.length; i++) {
            const [id, call] = dispatched.tools[i];
            const response = call.call.response;
            if (null !== response) {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: response
                });
                // Update if processed
                if (null === toolCalls[i][1].call.response) {
                    batch.set(id, {call: {response: response}}, {merge: true});
                }
            }
        }
        batch.set(
            continuationDoc,
            {
                state: dispatched.suspended ? "suspended": "resolved",
                handOver: dispatched.handOver,
                updatedAt: FieldValue.serverTimestamp()
            },
            {merge: true}
        );

        if (this.logData) {
            tagLogger("DATA").d("Saving chat data: ", JSON.stringify(dispatched.data));
        }
        await updateChatData(dispatched.data);

        if (dispatched.suspended) {
            logger.d("Dispatch suspended");
            return Continuation.suspend();
        } else {
            logger.d("Dispatch resolved");
            return Continuation.resolve({
                data: dispatched.data,
                handOver: dispatched.handOver,
                responses: result
            });
        }
    }

    private async getChatData(): Promise<ChatDispatchData<CM>> {
        const chat = (await this.chatDocument.get()).data();
        if (undefined === chat) {
            return Promise.reject(new ChatError("not-found", true, "Chat not found"));
        }
        return {
            ownerId: chat.userId,
            chatDocumentPath: this.chatDocument.path,
            dispatchId: chat.latestDispatchId,
            sessionId: chat.sessionId || null,
            assistantConfig: chat.config.assistantConfig,
            meta: chat.meta
        };
    }
}
