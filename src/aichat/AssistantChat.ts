import {firestore} from "firebase-admin";
import {ChatData, ChatState, ChatStateUpdate} from "./data/ChatState";
import {logger} from "../logging";
import {ChatStatus} from "./data/ChatStatus";
import {Collections} from "./data/Collections";
import ShortUniqueId from "short-unique-id";
import {ChatMessage} from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import {TaskScheduler} from "./TaskScheduler";
import {ChatCommand} from "./data/ChatCommand";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import FieldValue = firestore.FieldValue;
import Firestore = firestore.Firestore;

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
    private readonly runIdGenerator = new ShortUniqueId({length: 16});

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
        dispatcherId: string
    ): Promise<ChatStateUpdate<DATA>> {
        logger.d(`Creating new chat with assistant ${assistantId}...`);
        const dispatchId = this.runIdGenerator.randomUUID();
        const status: ChatStatus = "creating";
        await document.set({
            userId: userId,
            config: {
                assistantId: assistantId,
                workerName: this.name,
                dispatcherId: dispatcherId
            },
            status: status,
            dispatchId: dispatchId,
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        const command: ChatCommand = {
            ownerId: userId,
            chatDocumentPath: document.path,
            dispatchId: dispatchId,
            type: "create"
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
            (current) => ["created", "userInput"].includes(current),
            "posting",
            async (state, dispatchId) => {
                const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;
                const batch = this.db.batch();
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
                await batch.commit();
                const command: ChatCommand = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: dispatchId,
                    type: "post"
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
            (current) => false === ["closing", "complete"].includes(current),
            "closing",
            async (state, dispatchId) => {
                logger.d("Closing chat: ", document.path);

                const command: ChatCommand = {
                    ownerId: userId,
                    chatDocumentPath: document.path,
                    dispatchId: dispatchId,
                    type: "close"
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
        block: (state: ChatState<DATA>, dispatchId: string) => Promise<ChatStateUpdate<DATA>>
    ): Promise<ChatStateUpdate<DATA>> {
        const dispatchId = this.runIdGenerator.randomUUID();
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
            if (false === checkStatus(state.status)) {
                logger.w(`Chat is in invalid state ${state.status}`);
                return Promise.reject(
                    new HttpsError("failed-precondition", "Can't perform this operation due to current chat state")
                );
            }
            const newState: ChatState<DATA> = {
                ...state,
                status: targetStatus,
                dispatchId: dispatchId
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

        return await block(await run, dispatchId);
    }
}

