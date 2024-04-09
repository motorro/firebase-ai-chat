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
import {assistantId, Data, threadId, chatState, data, Data2, userId} from "./mock";
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import {
    AiWrapper,
    ChatMessage,
    ChatCommand,
    ChatCommandData,
    ChatState,
    ChatError,
    ChatStatus,
    TaskScheduler,
    ToolsDispatcher,
    Collections,
    Meta
} from "@motorro/firebase-ai-chat-core";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {Dispatch, Run} from "@motorro/firebase-ai-chat-core";
import FieldValue = firestore.FieldValue;
import {OpenAiChatAction} from "../src/aichat/data/OpenAiChatAction";
import {ChatWorker} from "../src/aichat/ChatWorker";
import {OpenAiAssistantConfig} from "../src/aichat/data/OpenAiAssistantConfig";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Chat worker", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<OpenAiAssistantConfig, Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(Collections.messages) as CollectionReference<ChatMessage>;
    const chatDispatches = chatDoc.collection(Collections.dispatches) as CollectionReference<Dispatch>;
    const dispatchId = "dispatchId";
    const runId = "runId";
    const lastPostMessageId = "message-12345";
    const lastChatMessageId = "message-67890";
    const aiMessages: ReadonlyArray<[string, string]> = [["1", "I'm AI"], ["2", "Nice to meet you"]];

    const context: TaskContext = {
        executionCount: 0,
        id: runId,
        queueName: "Chat",
        retryCount: 0,
        scheduledTime: ""
    };

    const meta: Meta = {
        a: 1
    };

    const commandData: ChatCommandData = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        dispatchId: dispatchId,
        meta: meta
    };
    const createCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["create"]
    };
    const postCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["post"]
    };
    const runCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["run"]
    };
    const retrieveCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["retrieve"]
    };
    const switchToUserCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["switchToUserInput"]
    };
    const closeCommand: ChatCommand<OpenAiChatAction> = {
        commonData: commandData,
        actions: ["close"]
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

    async function createChat(thread?: string, status?: ChatStatus, dispatch?: string) {
        const dispatchDoc = dispatch || dispatchId;
        const data: ChatState<OpenAiAssistantConfig, Data> = {
            ...chatState,
            config: (thread ? {...chatState.config, threadId: thread} : chatState.config),
            ...(status ? {status: status} : {status: "processing"}),
            latestDispatchId: dispatchDoc
        };

        await chatDoc.set(data);
        await chatDispatches.doc(dispatchDoc).set({createdAt: FieldValue.serverTimestamp()});

        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            userId: userId,
            author: "user",
            createdAt: Timestamp.now(),
            inBatchSortIndex: index,
            dispatchId: dispatchId,
            text: message
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes create command", async function() {
        await createChat(undefined, "processing", dispatchId);

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: {
                ...chatState.config,
                threadId: threadId
            }
        });

        verify(wrapper.createThread(anything())).once();
    });

    it("processes post command", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.postMessage(anything(), anything())).thenReturn(Promise.resolve(lastPostMessageId));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            lastMessageId: lastPostMessageId
        });

        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[0]))).once();
        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[1]))).once();
    });

    it("processes run command", async function() {
        await createChat(threadId, "processing", dispatchId);

        const changedState: ChatState<OpenAiAssistantConfig, Data> = {
            ...chatState,
            data: {
                value: "Test2"
            }
        };
        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall(() => {
            return Promise.resolve(changedState.data);
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            data: changedState.data
        });

        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anyFunction())).once();
    });

    it("processes retrieve command", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.getMessages(anything(), anything())).thenReturn(Promise.resolve({
            messages: aiMessages,
            latestMessageId: lastChatMessageId
        }));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
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

    it("processes switch to user command", async function() {
        await createChat(threadId, "processing", dispatchId);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "userInput"
        });
    });

    it("processes close command", async function() {
        await createChat(threadId, "closing", dispatchId);

        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: closeCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });

        verify(wrapper.deleteThread(threadId)).once();
    });

    it("doesn't update chat if state changes while processing", async function() {
        await createChat(threadId, "processing");

        when(wrapper.getMessages(anything(), anything())).thenCall(async () => {
            await chatDoc.set({status: "complete"}, {merge: true});
            return {
                messages: aiMessages,
                latestMessageId: lastChatMessageId
            };
        });

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: retrieveCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });
    });

    it("sets retry if there are retries", async function() {
        await createChat(threadId, "processing");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        return worker.dispatch(request)
            .should
            .eventually
            .be.rejectedWith("AI error");
    });

    it("fails chat if there are no retries", async function() {
        await createChat(threadId, "processing");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "failed"
        });
    });

    it("completes run on success", async function() {
        await createChat(threadId, "processing");
        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };
        await worker.dispatch(request);

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("complete");
    });

    it("completes run on fail", async function() {
        await createChat(threadId, "processing");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await worker.dispatch(request);

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("complete");
    });

    it("sets run to retry on retry", async function() {
        await createChat(threadId, "processing");

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await worker.dispatch(request).catch(() => {});

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("waitingForRetry");
    });

    it("aborts if running in parallel", async function() {
        await createChat(threadId, "processing");
        await chatDispatches.doc(dispatchId)
            .collection(Collections.runs).doc(runId)
            .set({status: "running", createdAt: FieldValue.serverTimestamp()});

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };
        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
    });

    it("aborts if already run", async function() {
        await createChat(threadId, "processing");
        await chatDispatches.doc(dispatchId)
            .collection(Collections.runs).doc(runId)
            .set({status: "complete", createdAt: FieldValue.serverTimestamp()});

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };
        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
    });

    it("runs command batch", async function() {
        await createChat(threadId, "processing");
        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actions: ["create", "close"]
            }
        };

        await worker.dispatch(request);

        verify(wrapper.createThread(anything())).once();

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                commonData: commandData,
                actions: ["close"]
            }
        );
    });

    it("runs completion handler", async function() {
        await createChat(threadId, "processing");
        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actions: ["create"]
            }
        };

        let handlerCalled = false;
        await worker.dispatch(request, () => {
            handlerCalled = true;
        });

        verify(wrapper.createThread(anything())).once();
        handlerCalled.should.be.true;
    });
});
