import { firestore } from "firebase-admin";
import { AssistantConfig, ChatData, ChatState, ChatStateUpdate } from "./data/ChatState";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import Firestore = firestore.Firestore;
import { Meta } from "./data/Meta";
import { CommandScheduler } from "./CommandScheduler";
/**
 * Front-facing assistant chat
 * Runs AI chat saving state in the database
 * Clients get updates using subscriptions to document and collections
 * - Create - creates new chat
 * - Post message - posts message from client
 * - Close - closes chat
 * Functions post commands to processing table and complete ASAP
 */
export declare class AssistantChat<AC extends AssistantConfig, DATA extends ChatData> {
    private readonly db;
    private readonly scheduler;
    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Command scheduler
     */
    constructor(db: Firestore, scheduler: CommandScheduler);
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
    create(document: DocumentReference<ChatState<AC, DATA>>, userId: string, data: DATA, assistantConfig: AC, dispatcherId: string, messages?: ReadonlyArray<string>, meta?: Meta): Promise<ChatStateUpdate<DATA>>;
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
    singleRun(document: DocumentReference<ChatState<AC, DATA>>, userId: string, data: DATA, assistantConfig: AC, dispatcherId: string, messages: ReadonlyArray<string>, meta?: Meta): Promise<ChatStateUpdate<DATA>>;
    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     * @param meta Metadata to pass to chat worker
     */
    postMessage(document: DocumentReference<ChatState<AC, DATA>>, userId: string, messages: ReadonlyArray<string>, meta?: Meta): Promise<ChatStateUpdate<DATA>>;
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
    private insertMessages;
    /**
     * Closes chats
     * @param document Chat document reference
     * @param userId Owner user ID
     * @param meta Metadata to pass to chat worker
     */
    closeChat(document: DocumentReference<ChatState<AC, DATA>>, userId: string, meta?: Meta): Promise<ChatStateUpdate<DATA>>;
    /**
     * Runs block mutating chat status if current chat status is one of allowed
     * @param document Chat document
     * @param userId To check the user can perform block
     * @param checkStatus Checks current status for availability
     * @param targetStatus Target status
     * @param block Block to run
     * @private
     */
    private prepareDispatchWithChecks;
}