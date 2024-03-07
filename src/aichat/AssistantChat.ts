import {firestore} from "firebase-admin";
import {ChatData, ChatState, ChatStatus, ChatStateUpdate} from "./data/ChatState";
import {logger} from "../logging";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import {TaskScheduler} from "./TaskScheduler";
import {ChatCommandQueue} from "./data/ChatCommandQueue";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import FieldValue = firestore.FieldValue;
import Firestore = firestore.Firestore;
import {Dispatch} from "./data/Dispatch";

/**
 * Close command delay to settle down AI runs
 */
const SCHEDULE_CLOSE_AFTER = 3 * 60;

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

    private readonly name: string;
    private readonly scheduler: TaskScheduler;

    /**
     * Constructor
     * @param db Firestore
     * @param queueName Command queue name to dispatch commands
     * @param scheduler Task scheduler
     */
    constructor(db: Firestore, queueName: string, scheduler: TaskScheduler) {
        this.db = db;
        this.name = queueName;
        this.scheduler = scheduler;
    }

    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantId Assistant ID
     * @param dispatcherId Dispatcher ID to use for tool calls
     */
    async create(
        document: DocumentReference<ChatState<DATA>>,
        userId: string,
        data: DATA,
        assistantId: string,
        dispatcherId: string,
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d(`Creating new chat with assistant ${assistantId}...`);
        const batch = this.db.batch();
        const status: ChatStatus = "processing";
        const dispatchDoc = document.collection(Collections.dispatches).doc() as DocumentReference<Dispatch>;

        batch.set(document, {
            userId: userId,
            config: {
                assistantId: assistantId,
                workerName: this.name,
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
        await batch.commit();

        const command: ChatCommandQueue = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchDoc.id,
            actions: ["create", "switchToUserInput"]
        };
        await this.scheduler.schedule(
            this.name,
            command
        );
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
     */
    async postMessage(
        document: DocumentReference<ChatState<DATA>>,
        userId: string,
        messages: ReadonlyArray<string>
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d("Posting user messages to: ", document.path);
        return this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => ["userInput"].includes(current),
            "processing",
            async (state) => {
                const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;
                const batch = this.db.batch();
                messages.forEach((message, index) => {
                    batch.create(
                        messageList.doc(),
                        {
                            userId: userId,
                            dispatchId: state.latestDispatchId,
                            author: "user",
                            text: message,
                            inBatchSortIndex: index,
                            createdAt: FieldValue.serverTimestamp()
                        }
                    );
                });
                await batch.commit();
                const command: ChatCommandQueue = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: state.latestDispatchId,
                    actions: ["post", "run", "retrieve", "switchToUserInput"]
                };
                await this.scheduler.schedule(
                    this.name,
                    command
                );

                return {
                    status: state.status,
                    data: state.data
                };
            }
        );
    }

    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    async closeChat(
        document: DocumentReference<ChatState<DATA>>,
        userId: string
    ): Promise<ChatStateUpdate<DATA>> {
        return this.prepareDispatchWithChecks(
            document,
            userId,
            (current) => false === ["closing", "complete", "failed"].includes(current),
            "closing",
            async (state) => {
                logger.d("Closing chat: ", document.path);

                const command: ChatCommandQueue = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: state.latestDispatchId,
                    actions: ["close"]
                };
                await this.scheduler.schedule(
                    this.name,
                    command,
                    {
                        scheduleDelaySeconds: SCHEDULE_CLOSE_AFTER
                    }
                );

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
        document: DocumentReference<ChatState<DATA>>,
        userId: string,
        checkStatus: (currentStatus: ChatStatus) => boolean,
        targetStatus: ChatStatus,
        block: (state: ChatState<DATA>) => Promise<ChatStateUpdate<DATA>>
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
            const newState: ChatState<DATA> = {
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

