import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {firestore} from "firebase-admin";
import {anything, deepEqual, strictEqual, instance, mock, reset, verify, when, anyFunction} from "ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, Data, threadId, chatState, data, MESSAGES, Data2} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import {
    AiWrapper,
    ChatCommand,
    ChatMessage,
    ChatState,
    ChatStatus,
    ChatWorker,
    ToolsDispatcher
} from "../lib";
import {HttpsError} from "firebase-functions/v2/https";

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
        dispatchId: runId
    };
    const closeCommand: ChatCommand = {
        doc: chatDoc,
        type: "close",
        dispatchId: runId
    };

    let wrapper: AiWrapper;
    let dispatcher: ToolsDispatcher<Data>;
    let dispatcher2: ToolsDispatcher<Data2>;
    let worker: ChatWorker;

    before(async function() {
        wrapper = mock<AiWrapper>();

        dispatcher = mock<ToolsDispatcher<Data>>();
        dispatcher2 = mock<ToolsDispatcher<Data2>>();
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const dispatchers: Record<string, ToolsDispatcher<any>> = {
            "dispatcherId": dispatcher,
            "dispatcher2Id": dispatcher2
        };
        worker = new ChatWorker(db, instance(wrapper), dispatchers);
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(wrapper);
        await db.recursiveDelete(chats);
    });

    async function createChat(thread?: string, status?: ChatStatus, run?: string) {
        const data: ChatState<Data> = {
            ...chatState,
            config: (thread ? {...chatState.config, threadId: thread} : chatState.config),
            ...(status ? {status: status} : {status: "dispatching"}),
            ...(run ? {dispatchId: run} : {dispatchId: runId})
        };

        await chatDoc.set(data);
        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            author: "user",
            createdAt: Timestamp.now(),
            inBatchSortIndex: index,
            dispatchId: runId,
            text: message
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes post command", async function() {
        await createChat(undefined, "dispatching", runId);

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

    it("doesn't process chat if status is not dispatching", async function() {
        await createChat(undefined, "complete");
        await worker.runCommand(postCommand);
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
    });

    it("doesn't process chat for another run", async function() {
        await createChat(undefined, "dispatching", "other_run");
        await worker.runCommand(postCommand);
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "dispatching"
        });
    });

    it("doesn't update chat if state changes while processing", async function() {
        await createChat(undefined, "dispatching");

        when(wrapper.getMessages(anything(), anything())).thenCall(async () => {
            await chatDoc.set({status: "complete"}, {merge: true});
            return {
                messages: aiMessages,
                latestMessageId: lastChatMessageId
            };
        });

        await worker.runCommand(postCommand);
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
    });

    it("sets error if ai fails", async function() {
        await createChat(undefined, "dispatching");

        when(wrapper.createThread(anything())).thenReject(new HttpsError("internal", "AI error"));

        await worker.runCommand(postCommand);
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "failed"
        });
    });

    it("processes close command", async function() {
        await createChat(threadId, "dispatching", runId);

        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        await worker.runCommand(closeCommand);
        verify(wrapper.deleteThread(threadId)).once();
    });
});
