import {firestore} from "firebase-admin";
import {AiWrapper} from "./AiWrapper";
import {ToolsDispatcher} from "./ToolsDispatcher";
import {ChatCommand} from "./data/ChatCommand";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import {logger} from "../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;
import {ChatData, ChatState} from "./data/ChatState";
import Transaction = firestore.Transaction;
import {ChatStatus} from "./data/ChatStatus";
import DocumentSnapshot = firestore.DocumentSnapshot;
import {ChatError} from "./data/ChatError";

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class ChatWorker {
    private readonly db: FirebaseFirestore.Firestore;

    private readonly wrapper: AiWrapper;
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>; // eslint-disable-line  @typescript-eslint/no-explicit-any

    private readonly defaultDispatcher: ToolsDispatcher<ChatData> = (data) => Promise.resolve({data: data});

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        wrapper: AiWrapper,
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>> // eslint-disable-line  @typescript-eslint/no-explicit-any
    ) {
        this.db = firestore;
        this.wrapper = wrapper;
        this.dispatchers = dispatchers;
    }

    /**
     * Set as a trigger to document creation in command collection
     * @param command Command data
     */
    async runCommand(command: ChatCommand): Promise<void> {
        switch (command.type) {
            case "post":
                await this.processWithCheck(
                    "dispatching",
                    command,
                    async (state) => await this.runPostChat(state, command)
                );
                break;
            case "close":
                await this.processWithCheck(
                    "dispatching",
                    command,
                    async (state) => await this.closeThread(state, command)
                );
                break;
            default:
                logger.e("Unknown command: ", command);
        }
    }

    /**
     * Posts messages and runs assistant
     * @param state Chat state
     * @param command Command data
     * @private
     */
    private async runPostChat(state: ChatState<ChatData>, command: ChatCommand): Promise<void> {
        logger.d(`Inserting messages. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);

        const messageCollectionRef = this.db
            .doc(command.chatDocumentPath)
            .collection(Collections.messages) as CollectionReference<ChatMessage>;

        const messages = await messageCollectionRef
            .where("dispatchId", "==", command.dispatchId)
            .orderBy("inBatchSortIndex")
            .get();

        const toPost: Array<string> = [];
        let latestInBatchId = 0;
        for (const msgDoc of messages.docs) {
            const data = msgDoc.data();
            if (undefined !== data) {
                toPost.push(data.text);
                latestInBatchId = data.inBatchSortIndex;
            }
        }
        ++latestInBatchId;

        if (0 === toPost.length) {
            await this.updateIfChecked("processing", command, (tx, state) => {
                const newState: ChatState<ChatData> = {
                    ...state,
                    status: "userInput"
                };

                tx.set(
                    this.db.doc(command.chatDocumentPath),
                    {
                        ...newState,
                        updatedAt: FieldValue.serverTimestamp()
                    },
                    {merge: true}
                );

                return newState;
            });
            return;
        }

        let threadId = state.config.threadId;

        // 1. Post messages
        if (undefined === threadId) {
            logger.d(`Creating thread. runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
            threadId = await this.wrapper.createThread({
                chat: command.chatDocumentPath
            });
        }
        let latestMessage = await this.wrapper.postMessages(threadId, toPost);

        // 2. Run assistant
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);

        // 3. Get new messages
        logger.d(`Getting messages, runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        const newMessages = await this.wrapper.getMessages(threadId, latestMessage);
        latestMessage = newMessages.latestMessageId;
        const batch = this.db.batch();
        newMessages.messages.forEach((message, index) => {
            batch.set(
                messageCollectionRef.doc(),
                {
                    userId: command.ownerId,
                    dispatchId: command.dispatchId,
                    author: "ai",
                    text: message,
                    inBatchSortIndex: latestInBatchId + index,
                    createdAt: FieldValue.serverTimestamp()
                }
            );
        });
        await batch.commit();

        // Recheck current status in case the chat was altered concurrently
        // as AI takes a long time to process
        await this.updateIfChecked("processing", command, (tx, state) => {
            const newState: ChatState<ChatData> = {
                ...state,
                status: "userInput",
                data: newData,
                config: {
                    ...state.config,
                    threadId: threadId
                },
                lastMessageId: latestMessage
            };

            tx.set(
                this.db.doc(command.chatDocumentPath),
                {
                    ...newState,
                    updatedAt: FieldValue.serverTimestamp()
                },
                {merge: true}
            );

            return newState;
        });
    }

    private async closeThread(state: ChatState<ChatData>, command: ChatCommand): Promise<void> {
        const threadId = state.config.threadId;
        if (undefined === threadId) {
            logger.d("No thread. Returning...");
            return;
        }
        logger.d("Closing chat thread", threadId);
        try {
            await this.wrapper.deleteThread(threadId);
        } catch (e) {
            logger.w("Error deleting thread", e);
        }

        // Recheck current status in case the chat was altered concurrently
        // as AI takes a long time to process
        await this.updateIfChecked("processing", command, (tx, state) => {
            const newState: ChatState<ChatData> = {
                ...state,
                status: "complete"
            };

            tx.set(
                this.db.doc(command.chatDocumentPath),
                {
                    ...newState,
                    updatedAt: FieldValue.serverTimestamp()
                },
                {merge: true}
            );

            return newState;
        });
    }

    private async updateWithCheck(
        status: ChatStatus,
        command: ChatCommand,
        block: (tx: Transaction, state: ChatState<ChatData>) => ChatState<ChatData>
    ): Promise<ChatState<ChatData>> {
        return await this.db.runTransaction(async (tx) => {
            const doc = await tx.get(this.db.doc(command.chatDocumentPath)) as DocumentSnapshot<ChatState<ChatData>>;
            const state = doc.data();
            if (false === doc.exists || undefined === state) {
                return Promise.reject(
                    new ChatError("not-found", true, "Chat not found")
                );
            }
            if (status !== state.status || command.dispatchId !== state.dispatchId) {
                return Promise.reject(
                    new ChatError("failed-precondition", true, "Chat status conflict")
                );
            }

            return block(tx, state);
        });
    }

    private async updateIfChecked(
        status: ChatStatus,
        command: ChatCommand,
        block: (tx: Transaction, state: ChatState<ChatData>) => ChatState<ChatData>
    ): Promise<ChatState<ChatData> | undefined> {
        let newState: ChatState<ChatData> | undefined = undefined;
        try {
            newState = await this.updateWithCheck(status, command, block);
        } catch (e) {
            logger.w("Error updating chat due to invalid state (possible concurrent update)", e);
        }
        return newState;
    }

    private async processWithCheck(
        status: ChatStatus,
        command: ChatCommand,
        block: (chatState: ChatState<ChatData>) => Promise<void>
    ): Promise<void> {
        logger.d(`Processing command: ${command.type}, runId ${command.dispatchId}, doc: ${command.chatDocumentPath}`);
        const run = this.updateWithCheck(status, command, (tx, state) => {
            const newState: ChatState<ChatData> = {
                ...state,
                status: "processing"
            };

            tx.set(
                this.db.doc(command.chatDocumentPath),
                {
                    ...newState,
                    updatedAt: FieldValue.serverTimestamp()
                }
            );

            return newState;
        });

        let state: ChatState<ChatData>;
        try {
            state = await run;
        } catch (e) {
            logger.w("Precondition error", e);
            return;
        }

        try {
            await block(state);
        } catch (e) {
            logger.e("Processing error", e);
            await this.db.doc(command.chatDocumentPath).set(
                {status: "failed", updatedAt: FieldValue.serverTimestamp()},
                {merge: true}
            );
        }
    }
}
