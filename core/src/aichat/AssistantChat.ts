import {firestore} from "firebase-admin";
import {
    AssistantConfig,
    ChatData,
    ChatState,
    ChatStatus,
    ChatStateUpdate
} from "./data/ChatState";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import {ChatCommandData} from "./data/ChatCommandData";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import Firestore = firestore.Firestore;
import {Dispatch} from "./data/Dispatch";
import {ChatMeta, Meta} from "./data/Meta";
import {CommandScheduler, getScheduler} from "./CommandScheduler";
import Transaction = firestore.Transaction;
import Timestamp = firestore.Timestamp;
import {HandOverResult} from "./data/HandOverResult";
import {tagLogger} from "../logging";
import {isStructuredMessage, NewMessage} from "./data/NewMessage";
import {ChatCleaner} from "./workers/ChatCleaner";
import {randomUUID} from "crypto";
import {UUID} from "node:crypto";
import PartialWithFieldValue = firestore.PartialWithFieldValue;
import FieldValue = firestore.FieldValue;
import {ChatError} from "./data/ChatError";
import {HandOverDelegate} from "./chat/handOver";

const logger = tagLogger("AssistantChat");

/**
 * Front-facing assistant chat
 * Runs AI chat saving state in the database
 * Clients get updates using subscriptions to document and collections
 * - Create - creates new chat
 * - Post message - posts message from client
 * - Close - closes chat
 * Functions post commands to processing table and complete ASAP
 */
export class AssistantChat<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    private readonly db: FirebaseFirestore.Firestore;
    private readonly schedulers: ReadonlyArray<CommandScheduler>;
    private readonly cleaner: ChatCleaner;

    private getScheduler(config: AssistantConfig): CommandScheduler {
        return getScheduler(this.schedulers, config);
    }

    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Command scheduler
     * @param cleaner Chat cleaner
     */
    constructor(db: Firestore, scheduler: CommandScheduler | ReadonlyArray<CommandScheduler>, cleaner: ChatCleaner) {
        this.db = db;
        this.schedulers = Array.isArray(scheduler) ? scheduler : [scheduler];
        this.cleaner = cleaner;
    }

    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantConfig Assistant Config
     * @param messages Starting messages
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Metadata saved to chat state
     */
    async create(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        data: DATA,
        assistantConfig: AssistantConfig,
        messages?: ReadonlyArray<NewMessage>,
        workerMeta?: WM,
        chatMeta?: CM
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Creating new chat with assistant:", JSON.stringify(assistantConfig));
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
        const sessionId: UUID = randomUUID();

        const action: (common: ChatCommandData) => Promise<void> = await this.db.runTransaction(async (tx) => {
            tx.set(document, {
                userId: userId,
                config: {
                    assistantConfig: assistantConfig
                },
                status: status,
                sessionId: sessionId,
                latestDispatchId: dispatchDoc.id,
                data: data,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                meta: chatMeta || null
            });
            tx.set(dispatchDoc, {
                createdAt: FieldValue.serverTimestamp()
            });

            const scheduler = this.getScheduler(assistantConfig);
            if (undefined !== messages && messages.length > 0) {
                this.insertMessages(tx, document, userId, dispatchDoc.id, messages, sessionId, chatMeta?.userMessageMeta);
                return async (common) => {
                    await scheduler.createAndRun(common);
                };
            }
            return async (common) => {
                await scheduler.create(common);
            };
        });

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: workerMeta || null
        };
        await action(command);

        return {
            status: status,
            data: data
        };
    }

    /**
     * Runs AI once and cleans up afterward
     * For tasks like analyzing some text once and getting results with function call
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantConfig Assistant Config
     * @param messages Starting messages
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Metadata saved to chat state
     * @return Chat state update
     */
    async singleRun(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        data: DATA,
        assistantConfig: AssistantConfig,
        messages: ReadonlyArray<NewMessage>,
        workerMeta?: WM,
        chatMeta?: CM
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Creating new single run with assistant:", JSON.stringify(assistantConfig));
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
        const sessionId: UUID = randomUUID();

        await this.db.runTransaction(async (tx) => {
            tx.set(document, {
                userId: userId,
                config: {
                    assistantConfig: assistantConfig
                },
                status: status,
                sessionId: sessionId,
                latestDispatchId: dispatchDoc.id,
                data: data,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                meta: chatMeta || null
            });
            tx.set(dispatchDoc, {
                createdAt: Timestamp.now()
            });
            this.insertMessages(tx, document, userId, dispatchDoc.id, messages, sessionId, chatMeta?.userMessageMeta);
        });

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: workerMeta || null
        };
        await this.getScheduler(assistantConfig).singleRun(command);
        return {
            status: status,
            data: data
        };
    }

    /**
     * Hands over chat to another assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param assistantConfig Assistant Config
     * @param handOverMessages Messages used to initialize the new chat passed (hidden from user)
     * @param workerMeta Metadata to pass to chat worker
     * @param chatMeta Chat meta to set for switched chat
     * @return Chat stack update
     */
    async handOver(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        assistantConfig: AssistantConfig,
        handOverMessages: ReadonlyArray<NewMessage>,
        workerMeta?: WM,
        chatMeta?: CM
    ): Promise<HandOverResult> {
        logger.d("Handing over chat: ", document.path);
        return await this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => ["userInput"].includes(current),
            async (tx, state) => {
                const delegate = new HandOverDelegate(this.db, this.schedulers);
                return await delegate.handOver(tx, document, state, {
                    config: assistantConfig,
                    messages: handOverMessages,
                    chatMeta: chatMeta,
                    workerMeta: workerMeta
                });
            }
        );
    }

    /**
     * Hands chat back to the next popped assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param handOverMessages Messages used to sent when handing back (hidden from user)
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat stack update
     */
    async handBack(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        handOverMessages?: ReadonlyArray<NewMessage>,
        workerMeta?: WM,
    ): Promise<HandOverResult> {
        logger.d("Popping chat state: ", document.path);
        return await this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => ["userInput"].includes(current),
            async (tx, state) => {
                const delegate = new HandOverDelegate(this.db, this.schedulers);
                return await delegate.handBack(tx, document, state, handOverMessages, workerMeta);
            }
        );
    }

    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat state update
     */
    async postMessage(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        messages: ReadonlyArray<NewMessage>,
        workerMeta?: Meta
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Posting user messages to: ", document.path);
        const state = await this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => ["userInput"].includes(current),
            async (tx, state, updateState) => {
                updateState({status: "processing"});
                this.insertMessages(
                    tx,
                    document,
                    userId,
                    state.latestDispatchId,
                    messages,
                    state.sessionId,
                    state.meta?.userMessageMeta
                );
                return state;
            }
        );

        const newData = (await document.get()).data();
        if (undefined === newData) {
            throw new ChatError("not-found", true, "Chat not found");
        }

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: state.latestDispatchId,
            meta: workerMeta || null
        };
        await this.getScheduler(state.config.assistantConfig).postAndRun(command);

        return {
            data: state.data,
            status: "processing"
        };
    }

    /**
     * Adds user messages
     * @param batch Write batch
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @param sessionId Chat session ID
     * @param chatMeta Common message meta
     * @private
     */
    private insertMessages(
        batch: FirebaseFirestore.Transaction,
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        dispatchId: string,
        messages: ReadonlyArray<NewMessage>,
        sessionId: string | undefined,
        chatMeta?: Meta,
    ) {
        const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;
        const dispatchDoc = document.collection(Collections.dispatches).doc(dispatchId) as DocumentReference<Dispatch>;
        let nextIndex = 0;
        messages.forEach((message) => {
            let text: string;
            let meta: Meta | null = chatMeta || null;
            let data: Readonly<Record<string, unknown>> | null = null;
            if (isStructuredMessage(message)) {
                text = message.text;
                if (message.meta) {
                    if (null != meta) {
                        meta = {...meta, ...message.meta};
                    } else {
                        meta = message.meta;
                    }
                }
                if (message.data) {
                    data = message.data;
                }
            } else {
                text = String(message);
            }
            batch.create(
                messageList.doc(),
                {
                    userId: userId,
                    dispatchId: dispatchId,
                    author: "user",
                    text: text,
                    data: data,
                    inBatchSortIndex: nextIndex,
                    createdAt: Timestamp.now(),
                    meta: meta,
                    ...(sessionId ? {sessionId: sessionId} : {})
                }
            );
            ++nextIndex;
        });
        batch.set(dispatchDoc, {nextMessageIndex: nextIndex}, {merge: true});
    }

    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    async closeChat(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string
    ): Promise<ChatStateUpdate<DATA>> {
        const state = await this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => false === ["closing", "complete", "failed"].includes(current),
            async (_tx, state, updateState) => {
                logger.d("Chat closed: ", document.path);
                updateState({status: "complete"});
                return state;
            }
        );
        await this.cleaner.cleanup(document.path);
        return {
            status: "complete",
            data: state.data
        };
    }

    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param checkStatus Checks current status for availability
     * @param block Block to run
     * @private
     */
    private async prepareDispatchWithChecks<R>(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        checkStatus: (currentStatus: ChatStatus) => boolean,
        block: (
            tx: Transaction,
            state: ChatState<AssistantConfig, DATA>,
            updateState: (update: PartialWithFieldValue<ChatState<AssistantConfig, DATA, CM>>) => void
        ) => Promise<R>
    ): Promise<R> {
        return await this.db.runTransaction(async (tx) => {
            const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
            let state = {...(await this.checkAndGetState(tx, document, userId, checkStatus)), latestDispatchId: dispatchDoc.id};

            const result = await (block(tx, state, (update) => {
                state = Object.assign(state, update);
                tx.set(document, {...state, updatedAt: FieldValue.serverTimestamp()});
            }));

            tx.set(dispatchDoc, {createdAt: Timestamp.now()}, {merge: true});
            tx.set(document, {latestDispatchId: dispatchDoc.id, updatedAt: FieldValue.serverTimestamp()}, {merge: true});

            return result;
        });
    }

    /**
     * Retrieves chat data
     * @param tx Active transaction
     * @param document Chat document
     * @param userId Bound user ID
     * @param checkStatus Checks current status for availability
     * @return Chat state if checks are ok
     * @private
     */
    private async checkAndGetState(
        tx: Transaction,
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        checkStatus: (currentStatus: ChatStatus) => boolean
    ): Promise<ChatState<AssistantConfig, DATA>> {
        const doc = await tx.get(document);
        const state = doc.data();
        if (false === doc.exists || undefined === state) {
            logger.w("Chat not found", document.path);
            return Promise.reject(
                new HttpsError("not-found", "Chat not found")
            );
        }
        if (userId !== state.userId) {
            logger.w("Access denied to:", userId);
            return Promise.reject(
                new HttpsError("permission-denied", "Access denied")
            );
        }
        if (false === checkStatus(state.status)) {
            logger.w(`Chat is in invalid state ${state.status}`);
            return Promise.reject(
                new HttpsError("failed-precondition", "Can't perform this operation due to current chat state")
            );
        }
        return state;
    }
}
