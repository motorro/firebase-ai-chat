import {firestore} from "firebase-admin";
import {ChatState, ChatStateUpdate} from "./data/ChatState";
import {logger} from "../logging";
import {ChatStatus} from "./data/ChatStatus";
import {Collections} from "./data/Collections";
import ShortUniqueId from "short-unique-id";
import {ChatMessage} from "./data/ChatMessage";
import CollectionReference = firestore.CollectionReference;
import {TaskScheduler} from "./TaskScheduler";
import {ChatCommand} from "./data/ChatCommand";
import {DeliverySchedule} from "firebase-admin/lib/functions";
import {HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import FieldValue = firestore.FieldValue;
import Firestore = firestore.Firestore;


/**
 * Front-facing assistant chat
 * Runs AI chat saving state in the database
 * Clients get updates using subscriptions to document and collections
 * - Create - creates new chat
 * - Post message - posts message from client
 * - Close - closes chat
 * Functions post commands to processing table and complete ASAP
 */
export class AssistantChat<DATA extends object> {
    private readonly db: FirebaseFirestore.Firestore;
    private readonly runIdGenerator = new ShortUniqueId({length: 16});

    private readonly name: string;
    private readonly scheduler: TaskScheduler;
    private readonly scheduling: DeliverySchedule;

    /**
     * Constructor
     * @param db Firestore
     * @param name Command dispatcher name
     * @param scheduler Task scheduler
     * @param scheduling Task scheduling
     */
    constructor(db: Firestore, name: string, scheduler: TaskScheduler, scheduling: DeliverySchedule = {}) {
        this.db = db;
        this.name = name;
        this.scheduler = scheduler;
        this.scheduling = scheduling;
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
        await document.set({
            userId: userId,
            config: {
                assistantId: assistantId,
                dispatcherId: dispatcherId
            },
            status: "created",
            data: data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return {
            status: "created",
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
        return this.runWithChecks(document, userId, "processing", ["created", "userInput"], async (state) => {
            const runId = this.runIdGenerator.randomUUID();
            const batch = this.db.batch();
            const messageList = document.collection(Collections.messages) as CollectionReference<ChatMessage>;

            messages.forEach((message, index) => {
                batch.create(
                    messageList.doc(),
                    {
                        runId: runId,
                        author: "user",
                        text: message,
                        inBatchSortIndex: index,
                        createdAt: FieldValue.serverTimestamp()
                    }
                );
            });
            await batch.commit();
            const command: ChatCommand = {
                doc: document,
                runId: runId,
                type: "post"
            };
            await this.scheduler.schedule(
                this.name,
                command,
                this.scheduling
            );

            return {
                status: state.status,
                data: state.data
            };
        });
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
        return this.runWithChecks(document, userId, "complete", ["created", "userInput", "processing"], async (state) => {
            logger.w("Closing chat: ", document.path);

            const runId = this.runIdGenerator.randomUUID();
            const command: ChatCommand = {
                doc: document,
                runId: runId,
                type: "close"
            };
            await this.scheduler.schedule(
                this.name,
                command,
                this.scheduling
            );

            return {
                status: state.status,
                data: state.data
            };
        });
    }

    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param statusToSet Status to set on chat
     * @param requiredStatus Allowed statuses to run block
     * @param block Block to run
     * @private
     */
    private async runWithChecks(
        document: DocumentReference<ChatState<DATA>>,
        userId: string,
        statusToSet: ChatStatus,
        requiredStatus: ReadonlyArray<ChatStatus>,
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
            if (false === requiredStatus.includes(state.status)) {
                logger.w(`Chat is in invalid state ${state.status}, required:`, requiredStatus);
                return Promise.reject(
                    new HttpsError("failed-precondition", "Can't perform this operation due to current chat state")
                );
            }
            tx.set(
                document,
                {
                    status: statusToSet,
                    updatedAt: FieldValue.serverTimestamp()
                },
                {merge: true}
            );
            return {
                ...state,
                status: statusToSet
            };
        });

        return await block(await run);
    }
}

