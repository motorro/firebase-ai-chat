import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {anything, capture, deepEqual, imock, instance, reset, verify, when} from "@johanblumenberg/ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, data, Data, userId, chatState, CHATS, AiConfig} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import {ChatState, AssistantChat, Meta, Collections, CommandScheduler} from "../src";
import {AssistantConfig} from "../lib";
import {ChatContextStackEntry} from "../src/aichat/data/ChatState";
import {beforeEach} from "mocha";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];

describe("Assistant Chat", function() {
    const chats = db.collection(CHATS) as CollectionReference<ChatState<AiConfig, Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(Collections.messages);
    let scheduler: CommandScheduler;
    let chat: AssistantChat<Data>;

    before(async function() {
        scheduler = imock();
        chat = new AssistantChat<Data>(db, instance(scheduler));
    });

    after(async function() {
        test.cleanup();
    });

    beforeEach(function() {
        when(scheduler.isSupported(anything())).thenReturn(true);
    });

    afterEach(async function() {
        reset(scheduler);
        await db.recursiveDelete(chats);
    });

    it("creates chat record", async function() {
        const update = await chat.create(chatDoc, userId, data, {assistantId});
        when(scheduler.create(anything())).thenReturn(Promise.resolve());

        update.should.deep.include({
            status: "processing",
            data: data
        });

        const createdState: ChatState<AiConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === createdState) {
            throw new Error("Chat should be created");
        }
        createdState.should.deep.include({
            userId: userId,
            config: {
                assistantConfig: {assistantId}
            },
            data: data,
            status: "processing"
        });
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(createdState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;

        const [command] = capture(scheduler.create).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id
            }
        );
    });

    it("creates chat record with messages", async function() {
        const update = await chat.create(chatDoc, userId, data, {assistantId}, messages);
        when(scheduler.createAndRun(anything())).thenReturn(Promise.resolve());

        update.should.deep.include({
            status: "processing",
            data: data
        });

        const createdState: ChatState<AiConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === createdState) {
            throw new Error("Chat should be created");
        }
        createdState.should.deep.include({
            userId: userId,
            config: {
                assistantConfig: {assistantId}
            },
            data: data,
            status: "processing"
        });
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(createdState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;

        const insertedMessages = await chatMessages.get();
        insertedMessages.docs.should.have.lengthOf(messages.length);
        const insertedData = insertedMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        for (let i = 0; i < messages.length; i++) {
            insertedData[i].should.deep.include({
                userId: userId,
                author: "user",
                text: messages[i],
                dispatchId: dispatchDoc.id
            });
        }

        const [command] = capture(scheduler.createAndRun).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id
            }
        );
    });

    it("creates a single run", async function() {
        const meta: Meta = {a: 1};
        const update = await chat.singleRun(chatDoc, userId, data, {assistantId}, messages, meta);
        when(scheduler.singleRun(anything())).thenReturn(Promise.resolve());

        update.should.deep.include({
            status: "processing",
            data: data
        });

        const createdState: ChatState<AiConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === createdState) {
            throw new Error("Chat should be created");
        }
        createdState.should.deep.include({
            userId: userId,
            config: {
                assistantConfig: {assistantId}
            },
            data: data,
            status: "processing"
        });
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(createdState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;

        const insertedMessages = await chatMessages.get();
        insertedMessages.docs.should.have.lengthOf(messages.length);
        const insertedData = insertedMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        for (let i = 0; i < messages.length; i++) {
            insertedData[i].should.deep.include({
                userId: userId,
                author: "user",
                text: messages[i],
                dispatchId: dispatchDoc.id
            });
        }

        const [command] = capture(scheduler.singleRun).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id,
                meta: meta
            }
        );
    });

    it("posts a message to the chat", async function() {
        await chatDoc.set(chatState);
        when(scheduler.postAndRun(anything())).thenReturn(Promise.resolve());

        const update = await chat.postMessage(chatDoc, userId, messages);

        update.should.deep.include({
            status: "processing",
            data: data
        });
        const updatedState: ChatState<AiConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        updatedState.should.deep.include({
            status: "processing"
        });
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(updatedState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;

        const insertedMessages = await chatMessages.get();
        insertedMessages.docs.should.have.lengthOf(messages.length);
        const insertedData = insertedMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        for (let i = 0; i < messages.length; i++) {
            insertedData[i].should.deep.include({
                userId: userId,
                author: "user",
                text: messages[i],
                dispatchId: dispatchDoc.id
            });
        }

        const [command] = capture(scheduler.postAndRun).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id
            }
        );
    });

    it("does not post a message to the chat if not found", async function() {
        return chat.postMessage(chatDoc, userId, messages).should
            .eventually
            .be.rejectedWith("Chat not found");
    });

    it("does not post a message to the chat of another user", async function() {
        await chatDoc.set({
            ...chatState,
            userId: "some-other-user"
        });

        return chat.postMessage(chatDoc, userId, messages).should
            .eventually
            .be.rejectedWith("Access denied");
    });

    it("does not post a message to the chat if in ai state", async function() {
        await chatDoc.set({
            ...chatState,
            status: "processing"
        });

        return chat.postMessage(chatDoc, userId, messages).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not post a message to the chat if in complete state", async function() {
        await chatDoc.set({
            ...chatState,
            status: "complete"
        });

        return chat.postMessage(chatDoc, userId, messages).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not post a message to the chat if in complete state", async function() {
        await chatDoc.set({
            ...chatState,
            status: "failed"
        });

        return chat.postMessage(chatDoc, userId, messages).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("closes chat", async function() {
        await chatDoc.set(chatState);
        when(scheduler.close(anything())).thenReturn(Promise.resolve());

        const update = await chat.closeChat(chatDoc, userId);

        update.should.deep.include({
            status: "closing",
            data: data
        });
        const updatedState: ChatState<AiConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(updatedState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;
        updatedState.should.deep.include({
            status: "closing"
        });

        const [command] = capture(scheduler.close).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id
            }
        );
    });

    it("does not close a chat of another user", async function() {
        await chatDoc.set({
            ...chatState,
            userId: "some-other-user"
        });

        return chat.closeChat(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Access denied");
    });

    it("does not close a closed chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "complete"
        });

        return chat.closeChat(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not close a closing chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "closing"
        });

        return chat.closeChat(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not close a failed chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "failed"
        });

        return chat.closeChat(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("hands over chat", async function() {
        await chatDoc.set(chatState);
        when(scheduler.handOver(anything(), anything())).thenReturn(Promise.resolve());

        const config: AssistantConfig = {engine: "other"};
        const messages = ["Please help me with this"];
        const update = await chat.handOver(
            chatDoc,
            userId,
            config,
            messages
        );

        update.should.deep.include({
            status: "processing",
            data: data
        });
        const updatedState: ChatState<AssistantConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        updatedState.should.deep.include({
            config: {
                assistantConfig: config
            },
            status: "processing"
        });
        const dispatchDoc = chatDoc.collection(Collections.dispatches).doc(updatedState.latestDispatchId);
        (await dispatchDoc.get()).exists.should.be.true;

        const savedStateDocs = await chatDoc.collection(Collections.contextStack)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        savedStateDocs.docs.length.should.equal(1);
        const savedState = savedStateDocs.docs[0].data() as ChatContextStackEntry<Data>;
        savedState.should.deep.include({
            config: chatState.config,
            status: "userInput",
            latestDispatchId: chatState.latestDispatchId
        });
        savedState.latestDispatchId.should.not.equal(updatedState.latestDispatchId);

        verify(scheduler.isSupported(deepEqual(config))).once();
        const [command, passedMessages] = capture(scheduler.handOver).last();
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: dispatchDoc.id
            }
        );
        passedMessages.should.deep.equal(messages);
    });

    it("does not hand over a closed chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "complete"
        });

        return chat.handOver(chatDoc, userId, {engine: "other"}, []).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not hand over a closing chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "closing"
        });

        return chat.handOver(chatDoc, userId, {engine: "other"}, []).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not hand over a failed chat", async function() {
        await chatDoc.set({
            ...chatState,
            status: "failed"
        });

        return chat.handOver(chatDoc, userId, {engine: "other"}, []).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("hands back chat", async function() {
        await chatDoc.set(chatState);
        when(scheduler.handOver(anything(), anything())).thenReturn(Promise.resolve());
        when(scheduler.handBackCleanup(anything(), anything())).thenReturn(Promise.resolve());

        const config: AssistantConfig = {engine: "other"};
        const messages = ["Please help me with this"];
        await chat.handOver(
            chatDoc,
            userId,
            config,
            messages
        );

        const update = await chat.handBack(chatDoc, userId);
        update.should.deep.include({
            status: "userInput",
            data: data
        });

        const updatedState: ChatState<AssistantConfig, Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        updatedState.should.deep.include({
            config: chatState.config,
            status: "userInput",
            latestDispatchId: "dispatch"
        });

        const savedStateDocs = await chatDoc.collection(Collections.contextStack)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        savedStateDocs.docs.length.should.equal(0);

        verify(scheduler.isSupported(deepEqual(config))).twice();
        verify(scheduler.handBackCleanup(anything(), deepEqual(config))).once();
    });

    it("does not hand back a closed chat", async function() {
        when(scheduler.handOver(anything(), anything())).thenReturn(Promise.resolve());
        await chatDoc.set(chatState);
        await chat.handOver(chatDoc, userId, {}, []);
        await chatDoc.set({status: "complete"}, {merge: true});

        return chat.handBack(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not hand over a closing chat", async function() {
        when(scheduler.handOver(anything(), anything())).thenReturn(Promise.resolve());
        await chatDoc.set(chatState);
        await chat.handOver(chatDoc, userId, {}, []);
        await chatDoc.set({status: "closing"}, {merge: true});

        return chat.handBack(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });

    it("does not hand over a failed chat", async function() {
        when(scheduler.handOver(anything(), anything())).thenReturn(Promise.resolve());
        await chatDoc.set(chatState);
        await chat.handOver(chatDoc, userId, {}, []);
        await chatDoc.set({status: "failed"}, {merge: true});

        return chat.handBack(chatDoc, userId).should
            .eventually
            .be.rejectedWith("Can't perform this operation due to current chat state");
    });
});
