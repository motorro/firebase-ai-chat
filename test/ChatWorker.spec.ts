import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {firestore} from "firebase-admin";
import {
    anything,
    deepEqual,
    strictEqual,
    instance,
    imock,
    reset,
    verify,
    when,
    anyFunction,
    capture
} from "@johanblumenberg/ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {assistantId, Data, threadId, chatState, data, MESSAGES, Data2, userId} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import {
    AiWrapper,
    ChatCommand,
    ChatMessage,
    ChatState,
    ChatStatus,
    ChatWorker, TaskScheduler,
    ToolsDispatcher
} from "../lib";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {ChatError} from "../lib/aichat/data/ChatError";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Chat worker", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(MESSAGES) as CollectionReference<ChatMessage>;
    const runId = "runId";
    const lastPostMessageId = "message-12345";
    const lastChatMessageId = "message-67890";
    const aiMessages: ReadonlyArray<[string, string]> = [["1", "I'm AI"], ["2", "Nice to meet you"]];

    const context: TaskContext = {
        executionCount: 0,
        id: "",
        queueName: "",
        retryCount: 0,
        scheduledTime: ""
    };

    const createCommand: ChatCommand = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        type: "create",
        dispatchId: runId
    };
    const postCommand: ChatCommand = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        type: "post",
        dispatchId: runId
    };
    const runCommand: ChatCommand = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        type: "run",
        dispatchId: runId
    };
    const retrieveCommand: ChatCommand = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        type: "retrieve",
        dispatchId: runId
    };
    const closeCommand: ChatCommand = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        type: "close",
        dispatchId: runId
    };

    let wrapper: AiWrapper;
    let scheduler: TaskScheduler;
    let dispatcher: ToolsDispatcher<Data>;
    let dispatcher2: ToolsDispatcher<Data2>;
    let worker: ChatWorker;

    before(async function() {
        wrapper = imock<AiWrapper>();
        scheduler = imock<TaskScheduler>();
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        dispatcher = imock<ToolsDispatcher<Data>>();
        dispatcher2 = imock<ToolsDispatcher<Data2>>();
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const dispatchers: Record<string, ToolsDispatcher<any>> = {
            "dispatcherId": dispatcher,
            "dispatcher2Id": dispatcher2
        };
        worker = new ChatWorker(db, instance(scheduler), instance(wrapper), dispatchers);
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
            ...(status ? {status: status} : {status: "processing"}),
            ...(run ? {dispatchId: run} : {dispatchId: runId})
        };

        await chatDoc.set(data);
        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            userId: userId,
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

    it("processes create command", async function() {
        await createChat(undefined, "creating", runId);

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<ChatCommand> = {
            ...context,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "created",
            config: {
                ...chatState.config,
                threadId: threadId,
            }
        });

        verify(wrapper.createThread(anything())).once();
    });

    it("doesn't process chat creation if status is not creating", async function() {
        await createChat(undefined, "complete");

        const request: Request<ChatCommand> = {
            ...context,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
        verify(wrapper.createThread(anything())).never();
    });

    it("doesn't process chat creation for another run", async function() {
        await createChat(undefined, "creating", "other_run");

        const request: Request<ChatCommand> = {
            ...context,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "creating"
        });
        verify(wrapper.createThread(anything())).never();
    });

    it("processes post command", async function() {
        await createChat(threadId, "posting", runId);

        when(wrapper.postMessage(anything(), anything())).thenReturn(Promise.resolve(lastPostMessageId));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });

        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[0]))).once();
        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[1]))).once();

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                type: "run"
            }
        );
    });

    it("doesn't process posting if status is not posting", async function() {
        await createChat(threadId, "complete");

        const request: Request<ChatCommand> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
        verify(wrapper.postMessage(anything(), anything())).never();
    });

    it("doesn't process chat posting for another run", async function() {
        await createChat(threadId, "posting", "other_run");

        const request: Request<ChatCommand> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "posting"
        });
        verify(wrapper.postMessage(anything(), anything())).never();
    });

    it("processes run command", async function() {
        await createChat(threadId, "processing", runId);

        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall((args) => {
            return Promise.resolve(args[2]);
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "gettingMessages"
        });

        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anyFunction())).once();

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                type: "retrieve"
            }
        );
    });

    it("doesn't process running if status is not posting", async function() {
        await createChat(threadId, "complete");

        const request: Request<ChatCommand> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
        verify(wrapper.run(anything(), anything(), anything(), anything())).never();
    });

    it("doesn't process chat running for another run", async function() {
        await createChat(threadId, "processing", "other_run");

        const request: Request<ChatCommand> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
        verify(wrapper.run(anything(), anything(), anything(), anything())).never();
    });

    it("processes retrieve command", async function() {
        await createChat(threadId, "gettingMessages", runId);

        when(wrapper.getMessages(anything(), anything())).thenReturn(Promise.resolve({
            messages: aiMessages,
            latestMessageId: lastChatMessageId
        }));

        const request: Request<ChatCommand> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

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
            const message = insertedData[i];
            message.should.deep.include({
                userId: userId,
                author: "ai",
                text: aiMessages[i - 2][1]
            });
        }

        verify(wrapper.getMessages(strictEqual(threadId), strictEqual(lastChatMessageId)));
    });

    it("doesn't process retrieval if status is in wrong state", async function() {
        await createChat(threadId, "complete");

        const request: Request<ChatCommand> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
    });

    it("doesn't process retrieval for another run", async function() {
        await createChat(threadId, "gettingMessages", "other_run");

        const request: Request<ChatCommand> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "gettingMessages"
        });
    });


    it("processes close command", async function() {
        await createChat(threadId, "closing", runId);

        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand> = {
            ...context,
            data: closeCommand
        };

        await worker.dispatch(request);

        verify(wrapper.deleteThread(threadId)).once();
    });

    it("doesn't update chat if state changes while processing", async function() {
        await createChat(threadId, "gettingMessages");

        when(wrapper.getMessages(anything(), anything())).thenCall(async () => {
            await chatDoc.set({status: "complete"}, {merge: true});
            return {
                messages: aiMessages,
                latestMessageId: lastChatMessageId
            };
        });

        const request: Request<ChatCommand> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
    });

    it("sets retry if there are retries", async function() {
        await createChat(threadId, "creating");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));

        const request: Request<ChatCommand> = {
            ...context,
            data: createCommand
        };

        return worker.dispatch(request)
            .should
            .eventually
            .be.rejectedWith("AI error");
    });

    it("fails chat if there are no retries", async function() {
        await createChat(threadId, "creating");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        const request: Request<ChatCommand> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "failed"
        });
    });
});
