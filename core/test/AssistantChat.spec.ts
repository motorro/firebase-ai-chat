import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {anything, capture, imock, instance, reset, when} from "@johanblumenberg/ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, data, Data, dispatcherId, userId, chatState, CHATS, AiConfig} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import {ChatState, AssistantChat, Meta, Collections} from "../src";
import {CommandScheduler} from "../src/aichat/CommandScheduler";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];

describe("Assistant Chat", function() {
    const chats = db.collection(CHATS) as CollectionReference<ChatState<AiConfig, Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(Collections.messages);
    let scheduler: CommandScheduler;
    let chat: AssistantChat<AiConfig, Data>;

    before(async function() {
        scheduler = imock();
        chat = new AssistantChat<AiConfig, Data>(db, instance(scheduler));
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(scheduler);
        await db.recursiveDelete(chats);
    });

    it("creates chat record", async function() {
        const update = await chat.create(chatDoc, userId, data, {assistantId}, dispatcherId);
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
                assistantConfig: {assistantId},
                dispatcherId: dispatcherId
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
        const update = await chat.create(chatDoc, userId, data, {assistantId}, dispatcherId, messages);
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
                assistantConfig: {assistantId},
                dispatcherId: dispatcherId
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
        const update = await chat.singleRun(chatDoc, userId, data, {assistantId}, dispatcherId, messages, meta);
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
                assistantConfig: {assistantId},
                dispatcherId: dispatcherId
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
});
