import {BaseChatWorker} from "./BaseChatWorker";
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {Meta} from "../data/Meta";
import {
    ContinuationRequest,
    isContinuationCommandRequest,
    ToolCallData,
    ToolCallResponse, ToolCallsResult,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import { Request } from "firebase-functions/lib/common/providers/tasks";
import { ChatCommand } from "../data/ChatCommand";
import { ChatCommandData } from "../data/ChatCommandData";
import {TaskScheduler} from "../TaskScheduler";
import {logger} from "../../logging";
import {Collections} from "../data/Collections";
import {firestore} from "firebase-admin";
import DocumentReference = firestore.DocumentReference;
import CollectionReference = firestore.CollectionReference;
import {ToolsContinuationDispatchRunner} from "./ToolsContinuationDispatchRunner";
import {ChatError} from "../data/ChatError";
import {DispatchControl} from "./ChatWorker";

export class ToolContinuationWorker<AC extends AssistantConfig, DATA extends ChatData, M extends Meta> extends BaseChatWorker<ContinuationRequest<M>, AC, DATA> {
    private readonly isSupportedMeta: (meta: Meta) => meta is M
    private readonly dispatchRunner: ToolsContinuationDispatchRunner<DATA>;
    private readonly onResolved: (
        data: ChatCommandData,
        result: ToolCallsResult<DATA, M>,
        updateChatState: (state: Partial<ChatState<AC, DATA>>) => Promise<boolean>
    ) => Promise<void>;

    constructor(
        isSupportedMeta: (meta: Meta) => meta is M,
        onResolved: (
            data: ChatCommandData,
            result: ToolCallsResult<DATA, M>,
            updateChatState: (state: Partial<ChatState<AC, DATA>>) => Promise<boolean>
        ) => Promise<void>,
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        dispatchRunner: ToolsContinuationDispatchRunner<DATA>
    ) {
        super(firestore, scheduler);
        this.isSupportedMeta = isSupportedMeta;
        this.onResolved = onResolved;
        this.dispatchRunner = dispatchRunner;
    }

    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<ContinuationRequest<M>>> {
        return isContinuationCommandRequest(req, this.isSupportedMeta);
    }

    protected async doDispatch(action: ContinuationRequest<M>, data: ChatCommandData, _state: ChatState<AC, DATA, Readonly<Record<string, unknown>>>, control: DispatchControl<ContinuationRequest<M>, AC, DATA>): Promise<void> {
        logger.d("Continuation processing. Moving forward:", JSON.stringify(action), JSON.stringify(data));
        const continuationDocument = this.db.doc(data.chatDocumentPath).collection(Collections.continuations).doc(action.continuationId) as DocumentReference<ToolsContinuationData<DATA, M>>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError("not-found", true, "Continuation data not found"));
        }

        const toolCallData = (await toolCallsCollection.orderBy("index").get()).docs;
        const processedCalls: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = []
        const unprocessedCalls: Array<[DocumentReference<ToolCallData<DATA>>, ToolCallData<DATA>]> = [];
        toolCallData.forEach((it) => {
            const data = it.data();
            if (undefined !== data) {
                if (null != data.call.response) {
                    processedCalls.push([it.ref, data]);
                } else {
                    unprocessedCalls.push([it.ref, data]);
                }
            }
        });

        const result: Array<ToolCallResponse<DATA>> = [];
        let hasUpdates = false;
        let suspended = false;
        let dataSoFar = continuation.data;
        if (0 !== unprocessedCalls.length) {
            const dispatched = await this.dispatchRunner.dispatch(
                data,
                [continuationDocument, continuation],
                unprocessedCalls
            );

            // If all processed without suspension - return at once
            const batch = this.db.batch();
            for (const [id, call] of dispatched.tools) {
                if (null != call.call.response) {
                    result.push({
                        toolCallId: call.call.request.toolCallId,
                        toolName: call.call.request.toolName,
                        response: call.call.response
                    });
                    batch.set(id, {...call});
                    hasUpdates = true;
                } else {
                    logger.d("Suspended at:", JSON.stringify(call));
                    suspended = true;
                    break;
                }
            }

            if (hasUpdates) {
                dataSoFar = dispatched.data;
                batch.set(continuationDocument, {data: dataSoFar}, {merge: true});
                await batch.commit();
            }
        }

        if (false === suspended) {
            logger.d("All tools resolved. Returning...");
            processedCalls.forEach(([_id, call]) => {
                result.push({
                    toolCallId: call.call.request.toolCallId,
                    toolName: call.call.request.toolName,
                    response: call.call.response!
                });
            });
            await this.onResolved(
                data,
                {
                    data: dataSoFar,
                    responses: result,
                    meta: action.continuationMeta
                },
                control.updateChatState
            );
        }
    }
}