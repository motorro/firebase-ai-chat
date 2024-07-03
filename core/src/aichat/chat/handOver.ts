import {UUID} from "node:crypto";
import {randomUUID} from "crypto";
import {AssistantConfig, ChatContextStackEntry, ChatData, ChatState, ChatStatus} from "../data/ChatState";
import {Collections} from "../data/Collections";
import {CommandScheduler, getScheduler} from "../CommandScheduler";
import {ChatCommandData} from "../data/ChatCommandData";
import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;
import {ChatMeta, Meta} from "../data/Meta";
import DocumentReference = firestore.DocumentReference;
import {NewMessage} from "../data/NewMessage";
import PartialWithFieldValue = firestore.PartialWithFieldValue;
import FieldValue = firestore.FieldValue;
import {HandOverResult} from "../data/HandOverResult";
import {tagLogger} from "../../logging";
import {HttpsError} from "firebase-functions/v2/https";
import CollectionReference = firestore.CollectionReference;
import WithFieldValue = firestore.WithFieldValue;

const logger = tagLogger("HandOver");

export interface HandOverData<WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    readonly config: AssistantConfig,
    readonly messages?: ReadonlyArray<NewMessage>
    readonly chatMeta?: CM | null
    readonly workerMeta?: WM | null
}

export class HandOverDelegate {
    private readonly db: FirebaseFirestore.Firestore;
    private readonly schedulers: ReadonlyArray<CommandScheduler>;

    constructor(
        db: FirebaseFirestore.Firestore,
        schedulers: ReadonlyArray<CommandScheduler>
    ) {
        this.db = db;
        this.schedulers = schedulers;
    }

    async handOver<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta>(
        tx: FirebaseFirestore.Transaction,
        chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, CM>> | string,
        chatState: ChatState<AssistantConfig, DATA, CM>,
        data: HandOverData<WM, CM>
    ): Promise<HandOverResult> {
        logger.d(`Hand-over for: ${"string" === typeof chatDocument ? chatDocument : chatDocument.path}`, JSON.stringify(data));

        const chatDoc = "string" === typeof chatDocument ? this.db.doc(chatDocument) : chatDocument;
        const sessionId: UUID = randomUUID();
        const now = Timestamp.now();
        const stackEntry: ChatContextStackEntry<DATA> = {
            config: chatState.config,
            createdAt: now,
            meta: chatState.meta,
            ...(chatState.sessionId ? {sessionId: chatState.sessionId} : {})
        };
        tx.set(chatDoc.collection(Collections.contextStack).doc(), stackEntry);

        const newState: WithFieldValue<ChatState<AssistantConfig, DATA, CM>> = {
            ...chatState,
            config: {...chatState.config, assistantConfig: data.config},
            status: "processing",
            meta: data.chatMeta || null,
            sessionId: sessionId,
            updatedAt: FieldValue.serverTimestamp()
        };

        tx.set(chatDoc, newState);

        const scheduler = getScheduler(this.schedulers, data.config);
        const command: ChatCommandData = {
            ownerId: chatState.userId,
            chatDocumentPath: "string" === typeof chatDocument ? chatDocument : chatDocument.path,
            dispatchId: chatState.latestDispatchId,
            meta: data.workerMeta || null
        };
        await scheduler.handOver(command, data.messages || []);

        return {
            formerAssistantConfig: chatState.config.assistantConfig,
            formerChatMeta: chatState.meta,
            ...(chatState.sessionId ? {formerSessionId: chatState.sessionId} : {})
        };
    }

    async handBack<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta>(
        tx: FirebaseFirestore.Transaction,
        chatDocument: DocumentReference<ChatState<AssistantConfig, DATA, CM>> | string,
        chatState: ChatState<AssistantConfig, DATA, CM>,
        messages?: ReadonlyArray<NewMessage>,
        workerMeta?: WM | null
    ): Promise<HandOverResult> {
        logger.d(`Hand-back for: ${"string" === typeof chatDocument ? chatDocument : chatDocument.path}`);

        const chatDoc = "string" === typeof chatDocument ? this.db.doc(chatDocument) : chatDocument;
        const stackEntryQuery = (chatDoc.collection(Collections.contextStack) as CollectionReference<ChatContextStackEntry<DATA, CM>>)
            .orderBy("createdAt", "desc")
            .limit(1);
        const stackEntry = (await tx.get(stackEntryQuery)).docs[0];
        const stackEntryData = stackEntry?.data();
        if (undefined === stackEntry || undefined === stackEntryData) {
            logger.w("No state to pop while trying to hand-back");
            return Promise.reject(
                new HttpsError("failed-precondition", "No state to pop")
            );
        }

        logger.d("Handing back to:", JSON.stringify(stackEntry));
        const newStatus: ChatStatus = undefined !== messages && 0 !== messages.length ? "processing" : "userInput";
        const newState: PartialWithFieldValue<ChatState<AssistantConfig, DATA, CM>> = {
            ...chatState,
            config: stackEntryData.config,
            status: newStatus,
            meta: stackEntryData.meta,
            ...(stackEntryData.sessionId ? {sessionId: stackEntryData.sessionId} : {}),
            updatedAt: FieldValue.serverTimestamp()
        };
        tx.set(chatDoc, newState);
        tx.delete(stackEntry.ref);

        const scheduler = getScheduler(this.schedulers, stackEntryData.config.assistantConfig);
        const command: ChatCommandData = {
            ownerId: chatState.userId,
            chatDocumentPath: "string" === typeof chatDocument ? chatDocument : chatDocument.path,
            dispatchId: chatState.latestDispatchId,
            meta: workerMeta || null
        };
        await scheduler.handBack(command, messages || []);

        return {
            formerAssistantConfig: chatState.config.assistantConfig,
            formerChatMeta: chatState.meta,
            ...(chatState.sessionId ? {formerSessionId: chatState.sessionId} : {})
        };
    }
}
