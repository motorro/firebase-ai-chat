import {firestore} from "firebase-admin";
import {AssistantConfig, ChatData, ChatState, ChatStatus, ChatStateUpdate} from "./data/ChatState";
import {logger} from "../logging";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import {ChatCommandData} from "./data/ChatCommandData";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import FieldValue = firestore.FieldValue;
import Firestore = firestore.Firestore;
import {Dispatch} from "./data/Dispatch";
import {Meta} from "./data/Meta";
import {CommandScheduler} from "./CommandScheduler";

/**
 * Front-facing assistant chat
 * Runs AI chat saving state in the database
 * Clients get updates using subscriptions to document and collections
 * - Create - creates new chat
 * - Post message - posts message from client
 * - Close - closes chat
 * Functions post commands to processing table and complete ASAP
 */
export class AssistantChat<DATA extends ChatData> {
    private readonly db: FirebaseFirestore.Firestore;
    private readonly scheduler: CommandScheduler;

    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Command scheduler
     */
    constructor(db: Firestore, scheduler: CommandScheduler) {
        this.db = db;
        this.scheduler = scheduler;
    }

    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantConfig Assistant Config
     * @param dispatcherId Dispatcher ID to use for tool calls
     * @param messages Starting messages
     * @param meta Metadata to pass to chat worker
     */
    async create(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        data: DATA,
        assistantConfig: AssistantConfig,
        dispatcherId: string,
        messages?: ReadonlyArray<string>,
        meta?: Meta
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Creating new chat with assistant:", JSON.stringify(assistantConfig));
        const batch = this.db.batch();
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;

        batch.set(document, {
            userId: userId,
            config: {
                assistantConfig: assistantConfig,
                dispatcherId: dispatcherId
            },
            status: status,
            latestDispatchId: dispatchDoc.id,
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        batch.set(dispatchDoc, {
            createdAt: FieldValue.serverTimestamp()
        });

        let action: (common: ChatCommandData) => Promise<void> = async (common) => {
            await this.scheduler.create(common);
        };
        if (undefined !== messages && messages.length > 0) {
            this.insertMessages(batch, document, userId, dispatchDoc.id, messages);
            action = async (common) => {
                await this.scheduler.createAndRun(common);
            };
        }
        await batch.commit();

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: meta || null
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
     * @param dispatcherId Dispatcher ID to use for tool calls
     * @param messages Starting messages
     * @param meta Metadata to pass to chat worker
     */
    async singleRun(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        data: DATA,
        assistantConfig: AssistantConfig,
        dispatcherId: string,
        messages: ReadonlyArray<string>,
        meta?: Meta
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Creating new single run with assistant:", JSON.stringify(assistantConfig));
        const batch = this.db.batch();
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;

        batch.set(document, {
            userId: userId,
            config: {
                assistantConfig: assistantConfig,
                dispatcherId: dispatcherId
            },
            status: status,
            latestDispatchId: dispatchDoc.id,
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        batch.set(dispatchDoc, {
            createdAt: FieldValue.serverTimestamp()
        });
        this.insertMessages(batch, document, userId, dispatchDoc.id, messages);
        await batch.commit();

        const command: ChatCommandData = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            meta: meta || null
        };
        await this.scheduler.singleRun(command);
        return {
            status: status,
            data: data
        };
    }

    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     * @param meta Metadata to pass to chat worker
     */
    async postMessage(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        messages: ReadonlyArray<string>,
        meta?: Meta
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Posting user messages to: ", document.path);
        return this.prepareDispatchWithChecks(
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
                    messages
                ).commit();
                const command: ChatCommandData = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: state.latestDispatchId,
                    meta: meta || null
                };
                await this.scheduler.postAndRun(command);

                return {
                    status: state.status,
                    data: state.data
                };
            }
        );
    }

    /**
     * Adds user messages
     * @param batch Write batch
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @return Write batch
     * @private
     */
    private insertMessages(
        batch: FirebaseFirestore.WriteBatch,
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        dispatchId: string,
        messages: ReadonlyArray<string>
    ): FirebaseFirestore.WriteBatch {
        const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;
        messages.forEach((message, index) => {
            batch.create(
                messageList.doc(),
                {
                    userId: userId,
                    dispatchId: dispatchId,
                    author: "user",
                    text: message,
                    inBatchSortIndex: index,
                    createdAt: FieldValue.serverTimestamp()
                }
            );
        });
        return batch;
    }

    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     * @param meta Metadata to pass to chat worker
     */
    async closeChat(
        document: DocumentReference<ChatState<AssistantConfig, DATA>>,
        userId: string,
        meta?: Meta
    ): Promise<ChatStateUpdate<DATA>> {
        return this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => false === ["closing", "complete", "failed"].includes(current),
            "closing",
            async (state) => {
                logger.d("Closing chat: ", document.path);

                const command: ChatCommandData = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: state.latestDispatchId,
                    meta: meta || null
                };
                await this.scheduler.close(command);

                return {
                    status: state.status,
                    data: state.data
                };
            }
        );
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
        block: (state: ChatState<AssistantConfig, DATA>) => Promise<ChatStateUpdate<DATA>>
    ): Promise<ChatStateUpdate<DATA>> {
        const run = this.db.runTransaction(async (tx) => {
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
            const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;
            tx.set(dispatchDoc, {createdAt: FieldValue.serverTimestamp()});

            if (false === checkStatus(state.status)) {
                logger.w(`Chat is in invalid state ${state.status}`);
                return Promise.reject(
                    new HttpsError("failed-precondition", "Can't perform this operation due to current chat state")
                );
            }
            const newState: ChatState<AssistantConfig, DATA> = {
                ...state,
                status: targetStatus,
                latestDispatchId: dispatchDoc.id
            };

            tx.set(
                document,
                {
                    ...newState,
                    updatedAt: FieldValue.serverTimestamp()
                }
            );

            return newState;
        });

        const state = await run;

        return await block(state);
    }
}

