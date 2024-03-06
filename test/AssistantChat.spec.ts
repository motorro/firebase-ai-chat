import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {anything, capture, imock, instance, reset, when} from "@johanblumenberg/ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, data, Data, dispatcherId, userId, chatState, MESSAGES, CHATS, NAME} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import {ChatState, TaskScheduler, AssistantChat} from "../src";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];

describe("Assistant Chat", function() {
    const chats = db.collection(CHATS) as CollectionReference<ChatState<Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(MESSAGES);
    let scheduler: TaskScheduler;
    let chat: AssistantChat<Data>;

    before(async function() {
        scheduler = imock();
        chat = new AssistantChat<Data>(db, NAME, instance(scheduler));
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(scheduler);
        await db.recursiveDelete(chats);
    });

    it("creates chat thread and record", async function() {
        const update = await chat.create(chatDoc, userId, data, assistantId, dispatcherId);
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        update.should.deep.include({
            status: "creating",
            data: data
        });

        const createdState: ChatState<Data> | undefined = (await chatDoc.get()).data();
        if (undefined === createdState) {
            throw new Error("Chat should be created");
        }
        createdState.should.deep.include({
            userId: userId,
            config: {
                assistantId: assistantId,
                dispatcherId: dispatcherId,
                workerName: "Chat"
            },
            data: data,
            status: "creating"
        });

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                actions: ["create"]
            }
        );
    });

    it("posts a message to the chat", async function() {
        await chatDoc.set(chatState);
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const update = await chat.postMessage(chatDoc, userId, messages);

        update.should.deep.include({
            status: "posting",
            data: data
        });
        const updatedState: ChatState<Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        updatedState.should.deep.include({
            status: "posting"
        });

        const insertedMessages = await chatMessages.get();
        insertedMessages.docs.should.have.lengthOf(messages.length);
        const insertedData = insertedMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        for (let i = 0; i < messages.length; i++) {
            insertedData[i].should.deep.include({
                userId: userId,
                author: "user",
                text: messages[i]
            });
        }

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                actions: ["post", "run", "retrieve"]
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
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const update = await chat.closeChat(chatDoc, userId);

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                actions: ["close"]
            }
        );

        update.should.deep.include({
            status: "closing",
            data: data
        });
        const updatedState: ChatState<Data> | undefined = (await chatDoc.get()).data();
        if (undefined === updatedState) {
            throw new Error("Chat should exist");
        }
        updatedState.should.deep.include({
            status: "closing"
        });
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
});
