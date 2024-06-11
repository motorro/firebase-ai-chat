import {DispatchResult, isReducerSuccess} from "../ToolsDispatcher";
import {AssistantConfig, ChatData, ChatState} from "../data/ChatState";
import {firestore} from "firebase-admin";
import {tagLogger} from "../../logging";
import {Collections} from "../data/Collections";
import {ChatError} from "../data/ChatError";
import {
    ContinuationCommand,
    ToolCallData,
    ToolsContinuationData
} from "../data/ContinuationCommand";
import {TaskScheduler} from "../TaskScheduler";
import DocumentReference = firestore.DocumentReference;
import CollectionReference = firestore.CollectionReference;
import FieldValue = firestore.FieldValue;

const logger = tagLogger("ToolsContinuationScheduler");

/**
 * Registers tool result and launches continuation command for the next dispatch
 */
export interface ToolsContinuationScheduler<in DATA extends ChatData> {
    /**
     * Continues with next result launching continuation command
     * @param command Continuation command
     * @param response Dispatch response to continue
     */
    continue(
        command: ContinuationCommand<unknown>,
        response: DispatchResult<DATA>
    ): Promise<void>
}

/**
 * Creates tool continuation scheduler
 */
export interface ToolsContinuationSchedulerFactory {
    /**
     * Creates tool continuation scheduler
     * @param queueName Queue name to schedule continuation to
     * @returns Tools continuation scheduler
     */
    create<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA>
}

export class ToolsContinuationSchedulerFactoryImpl implements ToolsContinuationSchedulerFactory {
    private readonly firebase: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly logData: boolean;

    constructor(firebase: FirebaseFirestore.Firestore, scheduler: TaskScheduler, logData: boolean) {
        this.firebase = firebase;
        this.scheduler = scheduler;
        this.logData = logData;
    }

    create<DATA extends ChatData>(queueName: string): ToolsContinuationScheduler<DATA> {
        return new ToolsContinuationSchedulerImpl(queueName, this.firebase, this.scheduler, this.logData);
    }
}

/**
 * Continuation implementation
 */
export class ToolsContinuationSchedulerImpl<in DATA extends ChatData> implements ToolsContinuationScheduler<DATA> {
    private readonly queueName: string;
    private readonly db: FirebaseFirestore.Firestore;
    private readonly scheduler: TaskScheduler;
    private readonly logData: boolean;

    constructor(queueName: string, db: FirebaseFirestore.Firestore, scheduler: TaskScheduler, logData = false) {
        this.queueName = queueName;
        this.db = db;
        this.scheduler = scheduler;
        this.logData = logData;
    }

    async continue(
        command: ContinuationCommand<unknown>,
        response: DispatchResult<DATA>
    ): Promise<void> {
        logger.d("Dispatching continuation command:", JSON.stringify(command), JSON.stringify(response));
        // eslint-disable-next-line max-len
        const chatDocument = this.db.doc(command.commonData.chatDocumentPath) as DocumentReference<ChatState<AssistantConfig, DATA>>;
        // eslint-disable-next-line max-len
        const continuationDocument = chatDocument.collection(Collections.continuations).doc(command.continuation.continuationId) as DocumentReference<ToolsContinuationData>;
        const toolCallsCollection = continuationDocument.collection(Collections.toolCalls) as CollectionReference<ToolCallData<DATA>>;

        const continuation = (await continuationDocument.get()).data();
        if (undefined === continuation) {
            logger.w("Continuation data not found");
            return Promise.reject(new ChatError("not-found", true, "Continuation data not found"));
        }

        const toolCallDoc = toolCallsCollection.doc(command.continuation.tool.toolId);
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
            if (isReducerSuccess(response)) {
                const stateData = (await tx.get(chatDocument)).data();
                if (command.commonData.dispatchId === stateData?.latestDispatchId) {
                    if (this.logData) {
                        tagLogger("DATA").d("Saving chat data: ", JSON.stringify(response.data));
                    }
                    tx.set(chatDocument, {data: response.data, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
                } else {
                    logger.d("Document has dispatch another command. Data update cancelled");
                }
            }
            tx.set(toolCallDoc, {...toolCallData, call: {...toolCallData.call, response: response}});
            tx.set(
                continuationDocument,
                {
                    updatedAt: FieldValue.serverTimestamp()
                },
                {merge: true}
            );
        });
        await this.scheduler.schedule(this.queueName, command);
    }
}
