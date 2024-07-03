import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "./functionsTest";
import {
    anything,
    capture,
    deepEqual,
    imock,
    instance,
    reset,
    strictEqual,
    verify,
    when
} from "@johanblumenberg/ts-mockito";
import {chatState, data, Data, instructions1, instructionsId, threadId, toolsDefinition, userId} from "./mock";
import {
    AssistantConfig,
    ChatCleaner,
    ChatCleanupRegistrar,
    ChatCommand,
    ChatCommandData,
    ChatData,
    ChatMessage,
    ChatState,
    ChatStatus,
    ChatWorker,
    Collections,
    CommandScheduler,
    commonFormatContinuationError,
    Continuation,
    Dispatch,
    getReducerSuccess,
    HandOverDelegate,
    MessageMiddleware,
    Meta,
    TaskScheduler,
    ToolCallRequest,
    ToolCallsResult,
    ToolContinuationDispatcherFactory,
    ToolContinuationSoFar,
    ToolsContinuationDispatcher
} from "@motorro/firebase-ai-chat-core";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper, VertexAiAssistantConfig, VertexAiChatCommand, VertexAiSystemInstructions} from "../src";
import {VertexAiChatWorker} from "../src/aichat/VertexAiChatWorker";
import {ChatThreadMessage} from "../src/aichat/data/ThreadMessage";
import {VertexAiContinuationCommand} from "../src/aichat/data/VertexAiChatCommand";
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
    const config: VertexAiAssistantConfig = {
        engine: "vertexai",
        instructionsId,
        threadId
    };
    const cleanupCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: [{name: "cleanup", config: config}]
    };
    const handoverCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: [{name: "handOver", config: {engine: "other"}, messages: ["Message 1"]}]
    };
    const handbackCommand: VertexAiChatCommand = {
        engine: "vertexai",
        commonData: commandData,
        actionData: [{name: "handBack", messages: ["Message 1"]}]
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
    let commandScheduler: CommandScheduler;
    let cleaner: ChatCleaner;
    let cleanupRegistrar: ChatCleanupRegistrar;
    let worker: ChatWorker;

    before(async function() {
        wrapper = imock<AiWrapper>();
        scheduler = imock<TaskScheduler>();
        commandScheduler = imock<CommandScheduler>()
        cleaner = imock();
        cleanupRegistrar = imock();
        when(commandScheduler.isSupported(anything())).thenReturn(true);
        when(cleaner.cleanup(anything())).thenResolve();
        when(cleanupRegistrar.register(anything())).thenResolve();

        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);
    });

    // eslint-disable-next-line max-len
    function createWorker(ToolContinuationDispatcherFactory?: ToolContinuationDispatcherFactory, messageMiddleware?: ReadonlyArray<MessageMiddleware<ChatData>>) {
        let factory: ToolContinuationDispatcherFactory;
        if (undefined !== ToolContinuationDispatcherFactory) {
            factory = ToolContinuationDispatcherFactory;
        } else {
            const f: ToolContinuationDispatcherFactory = imock();
            const dispatcher: ToolsContinuationDispatcher<Data> = imock();
            when(f.getDispatcher(anything(), anything())).thenReturn(dispatcher);
            factory = instance(f);
        }
        worker = new VertexAiChatWorker(
            db,
            instance(scheduler),
            instance(wrapper),
            instructions,
            commonFormatContinuationError,
            instance(cleanupRegistrar),
            () => instance(cleaner),
            false,
            messageMiddleware || [],
            () => [instance(commandScheduler)],
            () => factory
        );
    }

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(wrapper);
        reset(scheduler);
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
        let index = 0;
        for (; index < toInsert.length; ++index) {
            const message = toInsert[index];
            await chatMessages.doc().set(message);
        }

        await chatDispatches.doc(dispatchDoc).set({createdAt: FieldValue.serverTimestamp(), nextMessageIndex: index});
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
        verify(cleanupRegistrar.register(deepEqual({
            ...createCommand,
            actionData: {name: "cleanup", config: {...chatState.config.assistantConfig, threadId: threadId}}
        })));
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
            },
            handOver: null
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
        const [thread, instructions, messages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: ToolContinuationSoFar<Data>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
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

    it("processes post with message middleware", async function() {
        await createChat(threadId, "processing", dispatchId);
        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.resolve({
            messages: aiMessages,
            data: {
                value: "test2"
            },
            handOver: null
        }));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        let middlewareCalled = false;

        createWorker(undefined, [
            async (
                messages,
                chatDocumentPath,
                _chatState,
                control
            ) => {
                messages.length.should.equal(2);
                chatDocumentPath.should.equal(chatDoc.path);
                await control.next(messages);
                middlewareCalled = true;
            }
        ]);

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
        const [thread, instructions, messages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: ToolContinuationSoFar<Data>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
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

        middlewareCalled.should.be.true;
    });

    it("message middleware inserts messages", async function() {
        await createChat(threadId, "processing", dispatchId);
        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.resolve({
            messages: aiMessages,
            data: {
                value: "test2"
            },
            handOver: null
        }));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        createWorker(undefined, [
            async (
                messages,
                _chatDocumentPath,
                _chatState,
                control
            ) => {
                await control.safeUpdate(async (_tx, _updateState, saveMessages) => {
                    saveMessages(messages);
                });
            }
        ]);

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
        const [thread, instructions, messages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: ToolContinuationSoFar<Data>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
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
            }],
            handOver: null
        };

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _saveData, getCommand) => {
            data.should.deep.equal(data);
            calls[0].should.deep.equal(toolCall);
            const command = getCommand.getContinuationCommand({continuationId: continuationId, tool: {toolId: toolCallId}});
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
                messages: [],
                handOver: null
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
        createWorker();

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);
        verify(wrapper.postMessage(strictEqual(threadId), anything(), anything(), anything(), anything())).once();
        verify(scheduler.schedule(anything(), anything())).never();
    });


    it("processes post command with hand-over", async function() {
        await createChat(threadId, "processing", dispatchId);

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
            }],
            handOver: {name: "handBack", messages: ["Message 1"]}
        };

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        const continuationFactory: ToolContinuationDispatcherFactory = imock();
        when(continuationFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _messages, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve({
                data: dispatchResult.value.data,
                messages: [],
                handOver: {name: "handBack", messages: ["Message 1"]}
            });
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        createWorker(instance(continuationFactory));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: postCommand
        };

        await worker.dispatch(request);
        const [, command] = capture(scheduler.schedule).last();
        command.should.deep.include({
            actionData: [
                {
                    name: "handBack",
                    messages: ["Message 1"],
                }
            ]
        });
    });

    it("processes explicit post command", async function() {
        await createChat(threadId, "processing", dispatchId);

        when(wrapper.postMessage<Data>(anything(), anything(), anything(), anything(), anything())).thenResolve(Continuation.resolve({
            messages: aiMessages,
            data: {
                value: "test2"
            },
            handOver: null
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
        const [thread, instructions, passedMessages, data] = capture<string, VertexAiSystemInstructions<Data>, ReadonlyArray<string>, Data, (data: ToolContinuationSoFar<Data>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>>(wrapper.postMessage).last();
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
            }],
            handOver: {name: "handBack", messages: ["Message 1"]}
        };

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        when(toolDispatcher.dispatchCommand(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _saveData, getCommand) => {
            data.should.deep.equal(data);
            calls[0].should.deep.equal(toolCall);
            const command = getCommand.getContinuationCommand({continuationId: continuationId, tool: {toolId: toolCallId}});
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
                data: dispatchResult.value.data,
                handOver: null
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

    it("processes continuation command with hand-over", async function() {
        await createChat(threadId, "processing", dispatchId);

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
            }],
            handOver: {name: "handBack", messages: ["Message 1"]}
        };

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        when(toolDispatcher.dispatchCommand(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        const continuationFactory: ToolContinuationDispatcherFactory = imock();
        when(continuationFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.processToolsResponse(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _instructions, _request, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve({
                messages: aiMessages,
                data: dispatchResult.value.data,
                handOver: {name: "handBack", messages: ["Message 1"]}
            });
        });

        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        createWorker(instance(continuationFactory));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: continueRunCommand
        };

        await worker.dispatch(request);
        const [, command] = capture(scheduler.schedule).last();
        command.should.deep.include({
            actionData: [
                {
                    name: "handBack",
                    messages: ["Message 1"],
                }
            ]
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

    it("runs hand back cleanup handler", async function() {
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: cleanupCommand
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

    it("runs hand-over command", async function() {
        when(commandScheduler.handOver(anything(), anything())).thenResolve();
        await createChat(undefined, "processing");
        createWorker();

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: handoverCommand
        };

        const result = await worker.dispatch(request);

        result.should.be.true;

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: {
                assistantConfig: {
                    engine: "other"
                }
            }
        });

        verify(commandScheduler.isSupported(deepEqual({engine: "other"}))).once();
        verify(commandScheduler.handOver(anything(), deepEqual(["Message 1"]))).once();
    });

    it("runs hand-back command", async function() {
        when(commandScheduler.handOver(anything(), anything())).thenResolve();
        await createChat(undefined, "userInput");
        await db.runTransaction(async (tx) => {
            await new HandOverDelegate(db, [instance(commandScheduler)]).handOver(
                tx,
                chatDoc,
                chatState,
                {
                    config: {engine: "other"}
                }
            );
        });

        when(commandScheduler.handBack(anything(), anything())).thenReturn(Promise.resolve());

        createWorker();

        const request: Request<VertexAiChatCommand> = {
            ...context,
            data: handbackCommand
        };

        const result = await worker.dispatch(request);

        result.should.be.true;

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: chatState.config
        });

        verify(commandScheduler.isSupported(deepEqual(chatState.config.assistantConfig))).once();
        verify(commandScheduler.handBack(anything(), deepEqual(["Message 1"]))).once();
    });
});
