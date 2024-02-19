import { firestore } from "firebase-admin";
import { ChatData, ChatState, ChatStateUpdate } from "./data/ChatState";
import { TaskScheduler } from "./TaskScheduler";
import { DeliverySchedule } from "firebase-admin/lib/functions";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
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
export declare class AssistantChat<DATA extends ChatData> {
    private readonly db;
    private readonly runIdGenerator;
    private readonly name;
    private readonly scheduler;
    private readonly scheduling;
    /**
     * Constructor
     * @param db Firestore
     * @param name Command dispatcher name
     * @param scheduler Task scheduler
     * @param scheduling Task scheduling
     */
    constructor(db: Firestore, name: string, scheduler: TaskScheduler, scheduling?: DeliverySchedule);
    /**
     * Creates new chat thread
     * @param document Document reference
     * @param userId Chat owner
     * @param data Chat data to reduce
     * @param assistantId Assistant ID
     * @param dispatcherId Dispatcher ID to use for tool calls
     */
    create(document: DocumentReference<ChatState<DATA>>, userId: string, data: DATA, assistantId: string, dispatcherId: string): Promise<ChatStateUpdate<DATA>>;
    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     */
    postMessage(document: DocumentReference<ChatState<DATA>>, userId: string, messages: ReadonlyArray<string>): Promise<ChatStateUpdate<DATA>>;
    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     */
    closeChat(document: DocumentReference<ChatState<DATA>>, userId: string): Promise<ChatStateUpdate<DATA>>;
    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param requiredStatus Allowed statuses to run block
     * @param block Block to run
     * @private
     */
    private prepareDispatchWithChecks;
}
