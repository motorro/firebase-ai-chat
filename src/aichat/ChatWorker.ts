import {firestore} from "firebase-admin";
import {AiWrapper} from "./AiWrapper";
import {ToolsDispatcher} from "./ToolsDispatcher";
import {ChatCommand} from "./data/ChatCommand";
import {Collections} from "./data/Collections";
import {ChatMessage} from "./data/ChatMessage";
import {logger} from "../logging";
import FieldValue = firestore.FieldValue;
import CollectionReference = firestore.CollectionReference;

/**
 * Chat worker that dispatches chat commands and runs AI
 */
export class ChatWorker {
    private readonly db: FirebaseFirestore.Firestore;

    private readonly wrapper: AiWrapper;
    private readonly dispatchers: Readonly<Record<string, ToolsDispatcher<object>>>;

    private readonly defaultDispatcher: ToolsDispatcher<object> = (data) => Promise.resolve(data);

    /**
     * Constructor
     * @param firestore Firestore reference
     * @param wrapper AI wrapper
     * @param dispatchers Tools dispatcher map
     */
    constructor(
        firestore: FirebaseFirestore.Firestore,
        wrapper: AiWrapper,
        dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>
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
        logger.d(`Processing command: ${command.type}, runId ${command.runId}, doc: ${command.doc}`);

        try {
            switch (command.type) {
                case "post":
                    await this.runPostChat(command);
                    break;
                case "close":
                    await this.closeThread(command);
                    break;
                default:
                    logger.e("Unknown command: ", command);
            }
        } catch (e) {
            logger.e("Processing error", e);
            await command.doc.set(
                {status: "failed", updatedAt: FieldValue.serverTimestamp()},
                {merge: true}
            );
        }
    }

    /**
     * Posts messages and runs assistant
     * @param command Command data
     * @private
     */
    private async runPostChat(command: ChatCommand): Promise<void> {
        logger.d(`Inserting messages. runId ${command.runId}, doc: ${command.doc}`);

        // Check we have a document and it has a correct status
        const state = (await command.doc.get()).data();
        if (undefined === state) {
            logger.e("Document not found");
            return Promise.resolve();
        }
        if ("processing" !== state.status) {
            logger.d("Chat is not in processing state anymore", state.status);
            return Promise.resolve();
        }

        const messageCollectionRef = command.doc.collection(Collections.messages) as CollectionReference<ChatMessage>;

        const messages = await messageCollectionRef
            .where("runId", "==", command.runId)
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
            await command.doc.set(
                {
                    status: "userInput",
                    updatedAt: FieldValue.serverTimestamp()
                },
                {merge: true}
            );
            return;
        }

        let threadId = state.config.threadId;

        // 1. Post messages
        if (undefined === threadId) {
            logger.d(`Creating thread. runId ${command.runId}, doc: ${command.doc}`);
            threadId = await this.wrapper.createThread({
                chat: command.doc.path
            });
        }
        let latestMessage = await this.wrapper.postMessages(threadId, toPost);

        // 2. Run assistant
        const dispatcher = this.dispatchers[state.config.dispatcherId] || this.defaultDispatcher;
        const newData = await this.wrapper.run(threadId, state.config.assistantId, state.data, dispatcher);

        // 3. Get new messages
        logger.d(`Getting messages, runId ${command.runId}, doc: ${command.doc}`);
        const newMessages = await this.wrapper.getMessages(threadId, latestMessage);
        latestMessage = newMessages.latestMessageId;
        const batch = this.db.batch();
        newMessages.messages.forEach((message, index) => {
            batch.set(
                messageCollectionRef.doc(),
                {
                    runId: command.runId,
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
        if ("processing" !== (await command.doc.get()).data()?.status) {
            logger.d("Chat is not in processing state", state.status);
            return Promise.resolve();
        }

        await command.doc.set(
            {
                status: "userInput",
                data: newData,
                config: {
                    ...state.config,
                    threadId: threadId
                },
                lastMessageId: latestMessage,
                updatedAt: FieldValue.serverTimestamp()
            },
            {merge: true}
        );
    }

    private async closeThread(command: ChatCommand): Promise<void> {
        const state = (await command.doc.get()).data();
        if (undefined === state) {
            logger.e("Document not found");
            return Promise.resolve();
        }

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
    }
}
