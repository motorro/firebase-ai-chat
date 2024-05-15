import {DispatchResult, isDispatchSuccess} from "../ToolsDispatcher";
import {ChatData} from "../data/ChatState";
import {firestore} from "firebase-admin";
import {logger} from "../../logging";
import {Collections} from "../data/Collections";
import {ChatError} from "../data/ChatError";
import {
    ContinuationCommand,
    ToolCallData,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {Meta} from "../data/Meta";
import {TaskScheduler} from "../TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import CollectionReference = firestore.CollectionReference;

/**
 * Registers tool result and launches continuation command for the next dispatch
 */
export interface ToolsContinuation<DATA extends ChatData, M extends Meta = Meta> {
    /**
     * Continues with next result launching continuation command
     * @param command Continuation command
     * @param response Dispatch response to continue
     */
    continue(
        command: ContinuationCommand<M>,
        response: DispatchResult<DATA>
    ): Promise<void>
}

/**
 * Continuation implementation
 */
export class ToolContinuationImpl<DATA extends ChatData, M extends Meta = Meta> implements ToolsContinuation<DATA, M> {
    private readonly queueName: string;
    private readonly db: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;

    constructor(queueName: string, db: FirebaseFirestore.Firestore, scheduler: TaskScheduler) {
        this.queueName = queueName;
        this.db = db;
        this.scheduler = scheduler;
    }

    async continue(
        command: ContinuationCommand<M>,
        response: DispatchResult<DATA>
    ): Promise<void> {
        logger.d("Dispatching continuation command:", JSON.stringify(command), JSON.stringify(response));
        const continuationDocument = this.db.doc(command.commonData.chatDocumentPath).collection(Collections.continuations).doc(command.actionData.continuationId) as DocumentReference<ToolsContinuationData<DATA, M>>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError("not-found", true, "Continuation data not found"));
        }

        const toolCallDoc = toolCallsCollection.doc(command.actionData.responseId);
        await this.db.runTransaction(async (tx): Promise<void> => {
            const toolCallData = (await tx.get(toolCallDoc)).data();
            if (undefined === toolCallData) {
                logger.w("Tool call not found");
                return Promise.reject(new ChatError("not-found", true, "Inconsistent tool calls. Tool call not found"));
            }
            if (null !== toolCallData.call.response) {
                logger.w("Tool call already complete");
                return Promise.reject(new ChatError("already-exists", true, "Inconsistent tool calls. Tool call already fulfilled"));
            }
            tx.set(toolCallDoc, {...toolCallData, call: {...toolCallData.call, response: response}});
            if (isDispatchSuccess(response)) {
                tx.set(continuationDocument, {data: response.data}, {merge: true});
            }
        });
        await this.scheduler.schedule(this.queueName, command);
    }
}
