import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {firestore} from "firebase-admin";
import {anything, deepEqual, strictEqual, instance, mock, reset, verify, when, anyFunction} from "ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, Data, threadId, chatState, data, MESSAGES} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import {AiWrapper, ChatCommand, ChatMessage, ChatState, ChatWorker, ToolsDispatcher} from "../lib";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Assistant Chat", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(MESSAGES) as CollectionReference<ChatMessage>;
    const runId = "runId";
    const lastPostMessageId = "message-12345";
    const lastChatMessageId = "message-67890";
    const aiMessages = ["I'm AI", "Nice to meet you"];

    const postCommand: ChatCommand = {
        doc: chatDoc,
        type: "post",
        runId: runId
    };
    const closeCommand: ChatCommand = {
        doc: chatDoc,
        type: "close",
        runId: runId
    };

    let wrapper: AiWrapper;
    let dispatcher: ToolsDispatcher<Data>;
    let worker: ChatWorker;

    before(async function() {
        wrapper = mock<AiWrapper>();
        dispatcher = mock<ToolsDispatcher<Data>>();
        worker = new ChatWorker(db, instance(wrapper), {"dispatcherId": dispatcher});
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(wrapper);
        await firestore().recursiveDelete(chats);
    });

    async function createChat(thread?: string) {
        let data: ChatState<Data> = {
            ...chatState,
            status: "processing"
        };
        if (thread) {
            data = {
                ...data,
                config: {
                    ...data.config,
                    threadId: thread
                }
            };
        }

        await chatDoc.set(data);
        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            author: "user",
            createdAt: Timestamp.now(),
            inBatchSortIndex: index,
            runId: runId,
            text: message
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes post command", async function() {
        await createChat();

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));
        when(wrapper.postMessages(anything(), anything())).thenReturn(Promise.resolve(lastPostMessageId));
        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall((args) => {
            return Promise.resolve(args[2]);
        });
        when(wrapper.getMessages(anything(), anything())).thenReturn(Promise.resolve({
            messages: aiMessages,
            latestMessageId: lastChatMessageId
        }));

        await worker.runCommand(postCommand);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "userInput",
            lastMessageId: lastChatMessageId
        });

        const newChatMessages = await chatMessages.get();
        newChatMessages.docs.should.have.lengthOf(4);
        const insertedData = newChatMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        for (let i = 2; i < 4; i++) {
            insertedData[i].should.deep.include({
                author: "ai",
                text: aiMessages[i - 2]
            });
        }

        verify(wrapper.createThread(anything())).once();
        verify(wrapper.postMessages(strictEqual(threadId), deepEqual(messages))).once();
        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anyFunction())).once();
        verify(wrapper.getMessages(strictEqual(threadId), strictEqual(lastChatMessageId)));
    });

    it("processes close command", async function() {
        await createChat(threadId);

        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        await worker.runCommand(closeCommand);
        verify(wrapper.deleteThread(threadId)).once();
    });
});
