import { firestore } from "firebase-admin";
import { AssistantConfig, ChatData, ChatState, ChatStateUpdate } from "./data/ChatState";
import * as admin from "firebase-admin";
import DocumentReference = admin.firestore.DocumentReference;
import Firestore = firestore.Firestore;
import { ChatMeta, Meta } from "./data/Meta";
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
export declare class AssistantChat<DATA extends ChatData, WM extends Meta = Meta, CM extends ChatMeta = ChatMeta> {
    private readonly db;
    private readonly schedulers;
    private getScheduler;
    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Command scheduler
     */
    constructor(db: Firestore, scheduler: CommandScheduler | ReadonlyArray<CommandScheduler>);
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
    create(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, data: DATA, assistantConfig: AssistantConfig, messages?: ReadonlyArray<string>, workerMeta?: WM, chatMeta?: CM): Promise<ChatStateUpdate<DATA>>;
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
    singleRun(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, data: DATA, assistantConfig: AssistantConfig, messages: ReadonlyArray<string>, workerMeta?: WM, chatMeta?: CM): Promise<ChatStateUpdate<DATA>>;
    /**
     * Hands over chat to another assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param assistantConfig Assistant Config
     * @param handOverMessages Messages used to initialize the new chat passed  Hidden from user
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat stack update
     */
    handOver(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, assistantConfig: AssistantConfig, handOverMessages: ReadonlyArray<string>, workerMeta?: Meta): Promise<ChatStateUpdate<DATA>>;
    /**
     * Hands chat back to the next popped assistant
     * @param document Document reference
     * @param userId Chat owner
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat stack update
     */
    handBack(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, workerMeta?: Meta): Promise<ChatStateUpdate<DATA>>;
    /**
     * Posts messages to the thread
     * @param document Chat document
     * @param userId Chat owner
     * @param messages Messages to post
     * @param workerMeta Metadata to pass to chat worker
     * @return Chat state update
     */
    postMessage(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, messages: ReadonlyArray<string>, workerMeta?: Meta): Promise<ChatStateUpdate<DATA>>;
    /**
     * Adds user messages
     * @param batch Write batch
     * @param document Chat document
     * @param userId Owner user
     * @param dispatchId Dispatch ID
     * @param messages Messages to insert
     * @param meta User message meta if any
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
    closeChat(document: DocumentReference<ChatState<AssistantConfig, DATA>>, userId: string, meta?: Meta): Promise<ChatStateUpdate<DATA>>;
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
    /**
     * Retrieves chat data
     * @param tx Active transaction
     * @param document Chat document
     * @param userId Bound user ID
     * @param checkStatus Checks current status for availability
     * @return Chat state if checks are ok
     * @private
     */
    private checkAndGetState;
}
