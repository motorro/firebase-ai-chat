import {firestore} from "firebase-admin";
import {
    AssistantConfig,
    ChatData,
    ChatState,
    ChatStatus,
    ChatStateUpdate,
    ChatContextStackEntry
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
        const batch = this.db.batch();
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;

        batch.set(document, {
            userId: userId,
            config: {
                assistantConfig: assistantConfig
            },
            status: status,
            latestDispatchId: dispatchDoc.id,
            data: data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            meta: chatMeta || null
        });
        batch.set(dispatchDoc, {
            createdAt: Timestamp.now()
        });

        const scheduler = this.getScheduler(assistantConfig);
        let action: (common: ChatCommandData) => Promise<void> = async (common) => {
            await scheduler.create(common);
        };
        if (undefined !== messages && messages.length > 0) {
            this.insertMessages(batch, document, userId, dispatchDoc.id, messages, chatMeta?.userMessageMeta);
            action = async (common) => {
                await scheduler.createAndRun(common);
            };
        }
        await batch.commit();

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
        const batch = this.db.batch();
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;

        batch.set(document, {
            userId: userId,
            config: {
                assistantConfig: assistantConfig
            },
            status: status,
            latestDispatchId: dispatchDoc.id,
            data: data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            meta: chatMeta || null
        });
        batch.set(dispatchDoc, {
            createdAt: Timestamp.now()
        });
        this.insertMessages(batch, document, userId, dispatchDoc.id, messages, chatMeta?.userMessageMeta);
        await batch.commit();

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
     * @param handOverMessages Messages used to initialize the new chat passed  Hidden from user
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

        const [state, newState] = await this.db.runTransaction(async (tx) => {
            const state = await this.checkAndGetState(
                tx,
                document,
                userId,
                (current) => false === ["closing", "complete", "failed"].includes(current)
            );
            const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
            tx.set(dispatchDoc, {createdAt: Timestamp.now()});

            const now = Timestamp.now();
            const stackEntry: ChatContextStackEntry<DATA> = {
                config: state.config,
                createdAt: now,
                latestDispatchId: state.latestDispatchId,
                status: state.status,
                meta: state.meta
            };
            tx.set(document.collection(Collections.contextStack).doc(), stackEntry);

            const newState: ChatState<AssistantConfig, DATA> = {
                ...state,
                config: {...state.config, assistantConfig: assistantConfig},
                status: "processing",
                latestDispatchId: dispatchDoc.id,
                updatedAt: now,
                meta: chatMeta || null
            };
            tx.set(document, newState);

            return [state, newState];
        });

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: newState.latestDispatchId,
            meta: workerMeta || null
        };
        await this.getScheduler(newState.config.assistantConfig).handOver(command, handOverMessages);

        return {
            formerAssistantConfig: state.config.assistantConfig,
            formerChatMeta: state.meta
        };
    }

    /**
     * Hands chat back to the next popped assistant
     * @param document Document reference
     * @param userId Chat owner
     * @return Chat stack update
     */
    async handBack(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string
    ): Promise<HandOverResult> {
        logger.d("Popping chat state: ", document.path);
        const state = await this.db.runTransaction(async (tx) => {
            const state = await this.checkAndGetState(
                tx,
                document,
                userId,
                (current) => false === ["closing", "complete", "failed"].includes(current)
            );

            const stackEntryQuery = (document.collection(Collections.contextStack) as CollectionReference<ChatContextStackEntry<DATA>>)
                .orderBy("createdAt", "desc")
                .limit(1);
            const stackEntry = (await tx.get(stackEntryQuery)).docs[0];
            const stackEntryData = stackEntry?.data();
            if (undefined === stackEntry || undefined === stackEntryData) {
                return Promise.reject(
                    new HttpsError("failed-precondition", "No state to pop")
                );
            }

            const newState: ChatState<AssistantConfig, DATA> = {
                ...state,
                config: stackEntryData.config,
                status: stackEntryData.status,
                latestDispatchId: stackEntryData.latestDispatchId,
                updatedAt: Timestamp.now(),
                meta: stackEntryData.meta
            };
            tx.set(document, newState);
            tx.delete(stackEntry.ref);

            return state;
        });

        return {
            formerAssistantConfig: state.config.assistantConfig,
            formerChatMeta: state.meta
        };
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
            "processing",
            async (state) => {
                await this.insertMessages(
                    this.db.batch(),
                    document,
                    userId,
                    state.latestDispatchId,
                    messages,
                    state.meta?.userMessageMeta
                ).commit();
                const command: ChatCommandData = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: state.latestDispatchId,
                    meta: workerMeta || null
                };
                await this.getScheduler(state.config.assistantConfig).postAndRun(command);

                return state;
            }
        );
        return {
            data: state.data,
            status: state.status
        };
    }

    /**
     * Adds user messages
     * @param batch Write batch
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @param chatMeta Common message meta
     * @return Write batch
     * @private
     */
    private insertMessages(
        batch: FirebaseFirestore.WriteBatch,
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        dispatchId: string,
        messages: ReadonlyArray<NewMessage>,
        chatMeta?: Meta
    ): FirebaseFirestore.WriteBatch {
        const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;
        messages.forEach((message, index) => {
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
                    inBatchSortIndex: index,
                    createdAt: Timestamp.now(),
                    meta: meta
                }
            );
        });
        return batch;
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
            "complete",
            async (state) => {
                logger.d("Chat closed: ", document.path);
                await this.cleaner.cleanup(document.path);
                return state;
            }
        );
        return {
            status: state.status,
            data: state.data
        };
    }

    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param checkStatus Checks current status for availability
     * @param targetStatus Target status
     * @param block Block to run
     * @private
     */
    private async prepareDispatchWithChecks(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        checkStatus: (currentStatus: ChatStatus) => boolean,
        targetStatus: ChatStatus,
        block: (state: ChatState<AssistantConfig, DATA>) => Promise<ChatState<AssistantConfig, DATA>>
    ): Promise<ChatState<AssistantConfig, DATA>> {
        const run = this.db.runTransaction(async (tx) => {
            const state = await this.checkAndGetState(tx, document, userId, checkStatus);

            const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
            tx.set(dispatchDoc, {createdAt: Timestamp.now()});

            const newState: ChatState<AssistantConfig, DATA> = {
                ...state,
                status: targetStatus,
                latestDispatchId: dispatchDoc.id,
                updatedAt: Timestamp.now()
            };

            tx.set(document, newState);

            return newState;
        });

        const newState = await run;

        return await block(newState);
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
