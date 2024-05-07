import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "./functionsTest";
import {anything, capture, imock, instance, reset, verify, when} from "@johanblumenberg/ts-mockito";
import {
    chatState,
    Data,
    Data2,
    instructions1,
    instructions2,
    instructionsId,
    threadId,
    toolsDefinition,
    userId
} from "./mock";
import {
    ChatCommand,
    ChatCommandData,
    ChatMessage,
    ChatState,
    ChatStatus,
    Collections,
    Dispatch,
    Meta,
    TaskScheduler,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper, VertexAiAssistantConfig, VertexAiChatCommand, VertexAiChatWorker, VertexAiSystemInstructions} from "../src";
import {ChatThreadMessage} from "../src/aichat/data/ThreadMessage";
import CollectionReference = admin.firestore.CollectionReference;
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import FieldValue = firestore.FieldValue;

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Chat worker", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<VertexAiAssistantConfig, Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(Collections.messages) as CollectionReference<ChatMessage>;
    const chatDispatches = chatDoc.collection(Collections.dispatches) as CollectionReference<Dispatch>;
    const dispatchId = "dispatchId";
    const runId = "runId";
    const aiMessages: ReadonlyArray<ChatThreadMessage> = [
        {id: "1", createdAt: Timestamp.fromMillis(1), author: "ai", text: "I'm AI"},
        {id: "2", createdAt: Timestamp.fromMillis(2), author: "ai", text: "Nice to meet you"}
    ];

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
    const createCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: ["create"]
    };
    const postCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: ["post"]
    };
    const switchToUserCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: ["switchToUserInput"]
    };
    const closeCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: ["close"]
    };

    let wrapper: AiWrapper;
    let scheduler: TaskScheduler;
    let dispatcher: ToolsDispatcher<Data>;
    let dispatcher2: ToolsDispatcher<Data2>;
    let worker: VertexAiChatWorker;

    before(async function() {
        wrapper = imock<AiWrapper>();
        scheduler = imock<TaskScheduler>();
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        dispatcher = imock<ToolsDispatcher<Data>>();
        dispatcher2 = imock<ToolsDispatcher<Data2>>();
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const dispatchers: Record<string, VertexAiSystemInstructions<any>> = {
            [instructionsId]: {
                instructions: instructions1,
                tools: {
                    dispatcher: instance(dispatcher),
                    definition: toolsDefinition
                }
            },
            "instructions2": {
                instructions: instructions2,
                tools: {
                    dispatcher: instance(dispatcher2),
                    definition: toolsDefinition
                }
            }
        };
        worker = new VertexAiChatWorker(db, instance(scheduler), instance(wrapper), dispatchers);
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
        let config = chatState.config;
        if (undefined !== thread) {
            config = {
                ...chatState.config,
                assistantConfig: {
                    ...chatState.config.assistantConfig,
                    threadId: thread
                }
            }
        }
        const data: ChatState<VertexAiAssistantConfig, Data> = {
            ...chatState,
            config: config,
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
        const updatedChatState = chatStateUpdate.data() as ChatState<VertexAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.config.assistantConfig.should.deep.include({
            threadId: threadId
        });

        verify(wrapper.createThread(anything())).once();
    });

    it("processes post command", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything())).thenResolve({
            messages: aiMessages,
            data: {
                value: "test2"
            }
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<VertexAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            data: {
                value: "test2"
            }
        });

        const [thread, instructions, messages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data>(wrapper.postMessage).last();
        thread.should.be.equal(threadId);
        instructions.should.deep.include({instructions: instructions1});
        messages.should.include(messages[0], messages[1]);
        data.should.be.deep.equal(data);


        const newChatMessages = await chatMessages.get();
        newChatMessages.docs.should.have.lengthOf(4);
        const insertedData = newChatMessages.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data())
            .sort((a, b) => a["inBatchSortIndex"] - b["inBatchSortIndex"]);
        insertedData[0].should.deep.include({
            userId: userId,
            author: "user",
            text: messages[0]
        });
        insertedData[1].should.deep.include({
            userId: userId,
            author: "user",
            text: messages[1]
        });
        insertedData[2].should.deep.include({
            userId: userId,
            author: "ai",
            text: aiMessages[0].text
        });
        insertedData[3].should.deep.include({
            userId: userId,
            author: "ai",
            text: aiMessages[1].text
        });
    });

    it("processes switch to user command", async function() {
        await createChat(threadId, "processing", dispatchId);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<VertexAiAssistantConfig, Data>;
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
        const updatedChatState = chatStateUpdate.data() as ChatState<VertexAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });

        verify(wrapper.deleteThread(threadId)).once();
    });

    it("runs command batch", async function() {
        await createChat(threadId, "processing");
        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: {
                engine: "vertexai",
                commonData: commandData,
                actionData: ["create", "close"]
            }
        };

        await worker.dispatch(request);

        verify(wrapper.createThread(anything())).once();

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                commonData: commandData,
                actionData: ["close"]
            }
        );
    });

    it("runs completion handler", async function() {
        await createChat(threadId, "processing");
        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: {
                engine: "vertexai",
                commonData: commandData,
                actionData: ["create"]
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
