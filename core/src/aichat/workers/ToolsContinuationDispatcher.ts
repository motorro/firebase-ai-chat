import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {ToolsContinuationDispatchRunner} from "./ToolsContinuationDispatchRunner";
import {
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
import {ChatCommandData} from "../data/ChatCommandData";
import {Meta} from "../data/Meta";

/**
 * Tools dispatch continuation
 */
export interface ToolsContinuationDispatcher<DATA extends ChatData, M extends Meta = Meta> {
    /**
     * Dispatches tool calls
     * @param soFar Chat state so far
     * @param toolCalls Tool calls
     * @param meta Metadata to save with continuation
     * @return Tool calls continuation with at-once processed data or suspended
     */
    dispatch(
        soFar: DATA,
        toolCalls: ReadonlyArray<ToolCallRequest<DATA>>,
        meta: Meta
    ): Promise<Continuation<ToolCallsResult<DATA, M>>>
}

export class ToolsContinuationDispatcherImpl<DATA extends ChatData, M extends Meta = Meta> implements ToolsContinuationDispatcher<DATA, M> {
    private readonly commonData: ChatCommandData;
    private readonly dispatcherId: string;
    private readonly chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, M>>;
    private readonly db: FirebaseFirestore.Firestore;
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    private readonly dispatchRunner: ToolsContinuationDispatchRunner<DATA>;

    /**
     * Constructor
     * @param commonData Common command data
     * @param dispatcherId Dispatcher to use
     * @param db Firestore reference
     * @param dispatchRunner Dispatch runner
     * @return Tool calls continuation with at-once processed data or suspended
     */
    constructor(
        commonData: ChatCommandData,
        dispatcherId: string,
        db: FirebaseFirestore.Firestore,
        dispatchRunner: ToolsContinuationDispatchRunner<DATA>,
    ) {
        this.commonData = commonData;
        this.dispatcherId = dispatcherId;
        this.chatDocument = db.doc(commonData.chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, DATA, M>>;
        this.db = db;
        this.dispatchRunner = dispatchRunner;
    }

    async dispatch(
        soFar: DATA,
        toolCalls: ReadonlyArray<ToolCallRequest<DATA>>,
        meta: M
    ): Promise<Continuation<ToolCallsResult<DATA, M>>> {
        logger.d("Dispatching tool calls:", JSON.stringify(toolCalls))
        const continuationDocument = this.chatDocument.collection(Collections.continuations).doc() as DocumentReference<ToolsContinuationData<DATA, M>>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        let continuation: ToolsContinuationData<DATA, M> = {
            dispatcherId: this.dispatcherId,
            data: soFar,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            meta: meta
        };

        const dispatched = await this.dispatchRunner.dispatch(
            this.commonData,
            [continuationDocument, continuation],
            toolCalls.map((it, index) => [
                toolCallsCollection.doc(),
                {index: index, call: {request: it, response: null}}
            ])
        );

        continuation = {
            ...continuation,
            data: dispatched.data
        }

        // If all processed without suspension - return at once
        const result: Array<ToolCallResponse<DATA>> = [];
        let suspended = false;
        for (const [_id, call] of dispatched.tools) {
            if (null != call.call.response) {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: call.call.response
                });
            } else {
                suspended = true;
                break;
            }
        }

        if (false === suspended) {
            logger.d("All tools resolved. Returning...");
            return Continuation.resolve({
                data: dispatched.data,
                responses: result,
                meta: continuation.meta
            });
        }

        const batch = this.db.batch();
        batch.set(continuationDocument, {data: dispatched.data}, {merge: true});
        dispatched.tools.forEach(([ref, call]) => {
            batch.set(ref, call);
        });
        await batch.commit();
        return Continuation.suspend();
    }
}