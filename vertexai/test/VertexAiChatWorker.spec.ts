import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "./functionsTest";
import {anything, capture, imock, instance, reset, strictEqual, verify, when} from "@johanblumenberg/ts-mockito";
import {
    chatState, data,
    Data,
    instructions1,
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
    ChatWorker,
    Collections, commonFormatContinuationError,
    Continuation,
    ContinuationRequest,
    Dispatch, getReducerSuccess,
    Meta,
    TaskScheduler,
    ToolCallRequest,
    ToolCallsResult,
    ToolContinuationDispatcherFactory,
    ToolsContinuationDispatcher
} from "@motorro/firebase-ai-chat-core";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper, VertexAiAssistantConfig, VertexAiChatCommand, VertexAiSystemInstructions} from "../src";
import {VertexAiChatWorker} from "../src/aichat/VertexAiChatWorker";
import {ChatThreadMessage} from "../src/aichat/data/ThreadMessage";
import CollectionReference = admin.firestore.CollectionReference;
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import FieldValue = firestore.FieldValue;
import {VertexAiChatActions} from "../src/aichat/data/VertexAiChatAction";
import {VertexAiContinuationCommand} from "../src/aichat/data/VertexAiChatCommand";

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
    const explicitPostCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: [{name: "postExplicit", messages: ["hand over"]}]
    };
    const continueRunCommand: VertexAiContinuationCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: ["continuePost", "close"],
        continuation: {
            continuationId: "continuationId",
            tool: {
                toolId: "toolId"
            }
        }
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
    const config: VertexAiAssistantConfig = {
        engine: "vertexai",
        instructionsId,
        threadId
    };
    const handBackCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: [{name: "handBackCleanup", config: config}]
    };
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const instructions: Record<string, VertexAiSystemInstructions<any>> = {
        [instructionsId]: {
            instructions: instructions1,
            tools: {
                dispatcher: instance(() => data),
                definition: toolsDefinition
            }
        }
    };

    let wrapper: AiWrapper;
    let scheduler: TaskScheduler;
    let worker: ChatWorker;

    before(async function() {
        wrapper = imock<AiWrapper>();
        scheduler = imock<TaskScheduler>();
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);
    });

    function createWorker(ToolContinuationDispatcherFactory?: ToolContinuationDispatcherFactory) {
        let factory: ToolContinuationDispatcherFactory;
        if (undefined !== ToolContinuationDispatcherFactory) {
            factory = ToolContinuationDispatcherFactory;
        } else {
            const f: ToolContinuationDispatcherFactory = imock();
            const dispatcher: ToolsContinuationDispatcher<VertexAiChatActions, VertexAiContinuationCommand, Data> = imock();
            when(f.getDispatcher(anything(), anything())).thenReturn(dispatcher);
            factory = instance(f);
        }
        worker = new VertexAiChatWorker(
            db,
            instance(scheduler),
            instance(wrapper),
            instructions,
            commonFormatContinuationError,
            false,
            () => factory
        );
    }

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
            };
        }
        const data: ChatState<VertexAiAssistantConfig, Data> = {
            ...chatState,
            config: config,
            ...(status ? {status: status} : {status: "processing"}),
            latestDispatchId: dispatchDoc,
            meta: {
                aiMessageMeta: {
                    name: "ai"
                }
            }
        };

        await chatDoc.set(data);
        await chatDispatches.doc(dispatchDoc).set({createdAt: FieldValue.serverTimestamp()});

        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            userId: userId,
            author: "user",
            createdAt: Timestamp.now(),
            inBatchSortIndex: index,
            dispatchId: dispatchId,
            text: message,
            data: null,
            meta: null
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes create command", async function() {
        await createChat(undefined, "processing", dispatchId);
        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));
        createWorker();

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

    it("skips thread creation if already created", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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

        verify(wrapper.createThread(anything())).never();
    });

    it("processes post command", async function() {
        await createChat(threadId, "processing", dispatchId);
        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.resolve({
            messages: aiMessages,
            data: {
                value: "test2"
            }
        }));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());
        createWorker();

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

        // eslint-disable-next-line max-len
        const [thread, instructions, messages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: Data, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
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
            text: aiMessages[0].text,
            meta: {
                name: "ai"
            }
        });
        insertedData[3].should.deep.include({
            userId: userId,
            author: "ai",
            text: aiMessages[1].text,
            meta: {
                name: "ai"
            }
        });
    });

    it("processes post command when tools are dispatched", async function() {
        await createChat(threadId, "processing", dispatchId);

        const runId = "runId";
        const continuationId = "continuationId";
        const toolCallId = "toolCallId";
        const toolCall: ToolCallRequest = {
            toolCallId: "call1",
            toolName: "callOne",
            args: {a: 1}
        };
        const toolResponse: ToolCallsResult<Data> = {
            data: {
                value: "Test2"
            },
            responses: [{
                toolCallId: "toolId",
                toolName: "toolName",
                response: getReducerSuccess({
                    value: "Test2"
                })
            }]
        };

        const toolDispatcher: ToolsContinuationDispatcher<VertexAiChatActions, VertexAiContinuationCommand, Data> = imock();
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _saveData, getCommand: (continuationRequest: ContinuationRequest) => VertexAiContinuationCommand) => {
            data.should.deep.equal(data);
            calls[0].should.deep.equal(toolCall);
            const command = getCommand({continuationId: continuationId, tool: {toolId: toolCallId}});
            command.actionData.should.deep.equal(["continuePost"]);
            command.continuation.should.deep.equal({
                continuationId: continuationId,
                tool: {
                    toolId: toolCallId
                }
            });
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        const continuationFactory: ToolContinuationDispatcherFactory = imock();
        when(continuationFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _messages, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve({
                data: dispatchResult.value.data,
                messages: []
            });
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        createWorker(instance(continuationFactory));

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
                value: "Test2"
            }
        });
    });

    it("processes post command when tools are suspended", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.suspend());
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);
        verify(wrapper.postMessage(strictEqual(threadId), anything(), anything(), anything(), anything())).once();
        verify(scheduler.schedule(anything(), anything())).never();
    });

    it("processes explicit post command", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.resolve({
            messages: aiMessages,
            data: {
                value: "test2"
            }
        }));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: explicitPostCommand
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

        // eslint-disable-next-line max-len
        const [thread, instructions, passedMessages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: Data, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
        thread.should.be.equal(threadId);
        instructions.should.deep.include({instructions: instructions1});
        passedMessages.should.include("hand over");
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

    it("processes continuation command", async function() {
        await createChat(threadId, "processing", dispatchId);

        const runId = "runId";
        const continuationId = "continuationId";
        const toolCallId = "toolCallId";
        const toolCall: ToolCallRequest = {
            toolCallId: "call1",
            toolName: "callOne",
            args: {a: 1}
        };
        const toolResponse: ToolCallsResult<Data> = {
            data: {
                value: "Test2"
            },
            responses: [{
                toolCallId: "toolId",
                toolName: "toolName",
                response: getReducerSuccess({
                    value: "Test2"
                })
            }]
        };

        const toolDispatcher: ToolsContinuationDispatcher<VertexAiChatActions, VertexAiContinuationCommand, Data> = imock();
        when(toolDispatcher.dispatchCommand(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _saveData, getCommand: (continuationRequest: ContinuationRequest) => VertexAiContinuationCommand) => {
            data.should.deep.equal(data);
            calls[0].should.deep.equal(toolCall);
            const command = getCommand({continuationId: continuationId, tool: {toolId: toolCallId}});
            command.actionData.should.deep.equal(continueRunCommand.actionData);
            command.continuation.should.deep.equal({
                continuationId: continuationId,
                tool: {
                    toolId: toolCallId
                }
            });
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        const continuationFactory: ToolContinuationDispatcherFactory = imock();
        when(continuationFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.processToolsResponse(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _instructions, _request, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve({
                messages: aiMessages,
                data: dispatchResult.value.data
            });
        });

        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        createWorker(instance(continuationFactory));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: continueRunCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<VertexAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            data: {
                value: "Test2"
            }
        });

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

    it("runs hand back cleanup handler", async function() {
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: handBackCommand
        };

        let handlerCalled = false;
        await worker.dispatch(request, () => {
            handlerCalled = true;
        });

        verify(wrapper.deleteThread(threadId)).once();
        handlerCalled.should.be.false;
    });

    it("runs command batch", async function() {
        await createChat(undefined, "processing");
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
        await createChat(undefined, "processing");
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
