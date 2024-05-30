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
import {logger} from "../../logging";
import {Collections} from "../data/Collections";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import Timestamp = firestore.Timestamp;
import CollectionReference = firestore.CollectionReference;
import {ChatError} from "../data/ChatError";
import FieldValue = firestore.FieldValue;
import {ChatDispatchData} from "../ToolsDispatcher";

/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<A, C extends ContinuationCommand<A>, DATA extends ChatData> {
    /**
     * Dispatches tool calls
     * @param soFar Chat state so far
     * @param toolCalls Tool calls
     * @param getContinuationCommand Continuation command factory
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(
        soFar: DATA,
        toolCalls: ReadonlyArray<ToolCallRequest>,
        getContinuationCommand: (continuationRequest: ContinuationRequest) => C
    ): Promise<Continuation<ToolCallsResult<DATA>>>

    /**
     * Dispatches next tool call
     * @param command Continuation command
     * @param getContinuationCommand Continuation command factory
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatchCommand(
        command: C,
        getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>
    ): Promise<Continuation<ToolCallsResult<DATA>>>
}

/**
 * Continuation dispatcher implementation
 */
export class ToolsContinuationDispatcherImpl<A, C extends ContinuationCommand<A>, DATA extends ChatData> implements ToolsContinuationDispatcher<A, C, DATA> {
    private readonly dispatcherId: string;
    private readonly chatDocument: DocumentReference<ChatState<AssistantConfig, DATA>>;
    private readonly db: FirebaseFirestore.Firestore;
    private readonly dispatchRunner: ToolsContinuationDispatchRunner<DATA>;

    /**
     * Constructor
     * @param chatDocumentPath Chat document path
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * and thus fails continuation
     */
    constructor(
        chatDocumentPath: string,
        dispatcherId: string,
        db: FirebaseFirestore.Firestore,
        dispatchRunner: ToolsContinuationDispatchRunner<DATA>
    ) {
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, DATA>>;
        this.db = db;
        this.dispatchRunner = dispatchRunner;
    }

    async dispatch(
        soFar: DATA,
        toolCalls: ReadonlyArray<ToolCallRequest>,
        getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        logger.d("Dispatching tool calls");
        const continuationDocument = this.chatDocument.collection(Collections.continuations).doc() as DocumentReference<ToolsContinuationData<DATA>>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation: ToolsContinuationData<DATA> = {
            dispatcherId: this.dispatcherId,
            state: "suspended",
            data: soFar,
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
            continuationDocument,
            continuation,
            tools,
            getContinuationCommand
        );

        // Save only if suspended
        if (result.isSuspended()) {
            logger.d("Saving continuation to:", continuationDocument.path);
            await batch.commit();
        }

        return result;
    }

    async dispatchCommand(
        command: C,
        getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        logger.d("Continuation processing. Moving forward:", JSON.stringify(command));
        // eslint-disable-next-line max-len
        const continuationDocument = this.chatDocument.collection(Collections.continuations).doc(command.continuation.continuationId) as DocumentReference<ToolsContinuationData<DATA>>;
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
            continuationDocument,
            continuation,
            toolCalls,
            getContinuationCommand
        );
        logger.d("Saving continuation to:", continuationDocument.path);
        await batch.commit();
        return result;
    }

    private async doDispatch(
        batch: FirebaseFirestore.WriteBatch,
        continuationDoc: DocumentReference<ToolsContinuationData<DATA>>,
        continuation: ToolsContinuationData<DATA>,
        toolCalls: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]>,
        getContinuationCommand: (continuationRequest: ContinuationRequest) => ContinuationCommand<unknown>
    ): Promise<Continuation<ToolCallsResult<DATA>>> {
        const dispatched = await this.dispatchRunner.dispatch(
            continuation,
            toolCalls,
            await this.getChatData(),
            (continuationToolCall) => getContinuationCommand({
                continuationId: continuationDoc.id,
                tool: continuationToolCall
            })
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
                data: dispatched.data,
                updatedAt: FieldValue.serverTimestamp()
            },
            {merge: true}
        );
        if (dispatched.suspended) {
            logger.d("Dispatch suspened");
            return Continuation.suspend();
        } else {
            logger.d("Dispatch resolved");
            return Continuation.resolve({
                data: dispatched.data,
                responses: result
            });
        }
    }

    private async getChatData(): Promise<ChatDispatchData> {
        const chat = (await this.chatDocument.get()).data();
        if (undefined === chat) {
            return Promise.reject(new ChatError("not-found", true, "Chat not found"));
        }
        return {
            ownerId: chat.userId,
            chatDocumentPath: this.chatDocument.path,
            meta: chat.meta
        }
    }
}
