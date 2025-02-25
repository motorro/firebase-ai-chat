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
import {assistantId, chatState, Data, data, dispatcherId, threadId, userId} from "./mock";
import {
    AssistantConfig,
    ChatCleaner,
    ChatCleanupRegistrar,
    ChatCommand,
    ChatCommandData,
    ChatData,
    ChatError,
    ChatMessage,
    ChatState,
    ChatStatus,
    ChatWorker,
    Collections,
    CommandScheduler,
    Continuation,
    Dispatch, getFunctionSuccess,
    getReducerSuccess, HandOverDelegate,
    MessageMiddleware,
    Meta,
    Run,
    TaskScheduler,
    ToolCallRequest,
    ToolCallsResult,
    ToolContinuationDispatcherFactory,
    ToolsContinuationDispatcher
} from "@motorro/firebase-ai-chat-core";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {AiWrapper, OpenAiAssistantConfig, OpenAiChatCommand, OpenAiChatWorker} from "../src";
import {OpenAiContinuationCommand} from "../lib/aichat/data/OpenAiChatCommand";
import CollectionReference = admin.firestore.CollectionReference;
import QueryDocumentSnapshot = admin.firestore.QueryDocumentSnapshot;
import DocumentData = admin.firestore.DocumentData;
import Timestamp = admin.firestore.Timestamp;
import FieldValue = firestore.FieldValue;

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

    const createCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["create"]
    };
    const postCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["post"]
    };
    const explicitPostCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: [{name: "postExplicit", messages: ["hand over"]}]
    };
    const runCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["run", "retrieve"]
    };
    const continueRunCommand: OpenAiContinuationCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["continueRun", "retrieve"],
        meta: {
            runId: runId
        },
        continuation: {
            continuationId: "continuationId",
            tool: {
                toolId: "toolId"
            }
        }
    };
    const retrieveCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["retrieve"]
    };
    const switchToUserCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: ["switchToUserInput"]
    };
    const config: OpenAiAssistantConfig = {
        engine: "openai",
        assistantId,
        dispatcherId: dispatcherId,
        threadId: threadId
    };
    const cleanupCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: [{name: "cleanup", config: config}]
    };
    const handoverCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: [{name: "handOver", config: {engine: "other"}, messages: ["Message 1"]}]
    };
    const handbackCommand: OpenAiChatCommand = {
        engine: "openai",
        commonData: commandData,
        actionData: [{name: "handBack", messages: ["Message 1"]}]
    };

    let wrapper: AiWrapper;
    let scheduler: TaskScheduler;
    let commandScheduler: CommandScheduler;
    let toolContinuationDispatcherFactory: ToolContinuationDispatcherFactory;
    let cleaner: ChatCleaner;
    let cleanupRegistrar: ChatCleanupRegistrar;
    let worker: ChatWorker;

    before(async function() {
        wrapper = imock<AiWrapper>();
        scheduler = imock<TaskScheduler>();
        commandScheduler = imock<CommandScheduler>();
        toolContinuationDispatcherFactory = imock<ToolContinuationDispatcherFactory>();
        cleaner = imock();
        cleanupRegistrar = imock();
        when(cleaner.cleanup(anything())).thenResolve();
        when(cleanupRegistrar.register(anything())).thenResolve();
    });

    const createWorker = (middleware?: ReadonlyArray<MessageMiddleware<ChatData>>) => {
        worker = new OpenAiChatWorker(
            db,
            instance(scheduler),
            instance(wrapper),
            instance(toolContinuationDispatcherFactory),
            instance(cleanupRegistrar),
            () => instance(cleaner),
            false,
            middleware || [],
            () => [instance(commandScheduler)]
        );
    };

    after(async function() {
        test.cleanup();
    });

    beforeEach(function() {
        when(commandScheduler.isSupported(anything())).thenReturn(true);
    });

    afterEach(async function() {
        await db.recursiveDelete(chats);
        reset(wrapper);
        reset(scheduler);
        reset(commandScheduler);
        reset(toolContinuationDispatcherFactory);
        reset(cleaner);
        reset(cleanupRegistrar);
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
        const data: ChatState<OpenAiAssistantConfig, Data> = {
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
        createWorker();

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
                assistantConfig: {
                    ...chatState.config.assistantConfig,
                    threadId: threadId
                }
            }
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
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: {
                ...chatState.config,
                assistantConfig: {
                    ...chatState.config.assistantConfig,
                    threadId: threadId
                }
            }
        });

        verify(wrapper.createThread(anything())).never();
    });

    it("processes post command", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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
        updatedChatState.config.assistantConfig.should.deep.include({
            lastMessageId: lastPostMessageId
        });

        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[0]))).once();
        verify(wrapper.postMessage(strictEqual(threadId), strictEqual(messages[1]))).once();
    });

    it("processes explicit post command", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

        when(wrapper.postMessage(anything(), anything())).thenReturn(Promise.resolve(lastPostMessageId));
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: explicitPostCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.config.assistantConfig.should.deep.include({
            lastMessageId: lastPostMessageId
        });

        verify(wrapper.postMessage(strictEqual(threadId), strictEqual("hand over"))).once();
    });

    it("processes run command when tools are dispatched", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _updateState, getCommand) => {
            data.should.deep.equal(data);
            calls[0].should.deep.equal(toolCall);
            const command = getCommand.getContinuationCommand({continuationId: continuationId, tool: {toolId: toolCallId}});
            command.actionData.should.deep.equal(["continueRun", "retrieve"]);
            command.continuation.should.deep.equal({
                continuationId: continuationId,
                tool: {
                    toolId: toolCallId
                }
            });
            command.meta.should.deep.equal({
                runId: runId
            });
            return Promise.resolve(Continuation.resolve(toolResponse));
        });

        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve(dispatchResult.value.data);
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
            data: {
                value: "Test2"
            }
        });

        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anything())).once();
        verify(scheduler.schedule(anything(), anything())).once();
    });

    it("processes run command with hand-over", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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
                response: getFunctionSuccess({
                    value: "Test2"
                })
            }],
            handOver: {name: "handBack", messages: ["Message 1"]}
        };

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });

        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve(dispatchResult.value.data);
        });

        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);

        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anything())).once();
        const [, command] = capture(scheduler.schedule).last();
        command.should.deep.include({
            actionData: [
                "retrieve",
                {
                    name: "handBack",
                    messages: ["Message 1"]
                }
            ]
        });
    });

    it("processes run command when tools are suspended", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenResolve(Continuation.suspend());
        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));
        when(wrapper.run(anything(), anything(), anything(), anything())).thenCall(() => {
            return Promise.resolve(Continuation.suspend());
        });
        when(scheduler.schedule(anything(), anything(), anything())).thenReturn(Promise.resolve());

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: runCommand
        };

        await worker.dispatch(request);
        verify(wrapper.run(strictEqual(threadId), strictEqual(assistantId), deepEqual(data), anything())).once();
        verify(scheduler.schedule(anything(), anything())).never();
    });

    it("processes continuation command when tools are dispatched", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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
        when(toolDispatcher.dispatchCommand(anything(), anything(), anything(), anything())).thenCall(async () => {
            return Promise.resolve(Continuation.resolve(toolResponse));
        });
        // eslint-disable-next-line max-len
        when(toolDispatcher.dispatch(anything(), anything(), anything(), anything())).thenCall(async (data, calls, _updateState, getCommand) => {
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
            command.meta.should.deep.equal({
                runId: runId
            });
            return Promise.resolve(Continuation.resolve(toolResponse));
        });

        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.processToolsResponse(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve(dispatchResult.value.data);
        });

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: continueRunCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            data: {
                value: "Test2"
            }
        });
        verify(scheduler.schedule(anything(), anything())).once();
    });

    it("processes continuation command with saved hand-over", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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

        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        // eslint-disable-next-line max-len
        when(wrapper.processToolsResponse(anything(), anything(), anything(), anything(), anything())).thenCall(async (_threadId, _assistantId, _dataSoFar, dispatch) => {
            const dispatchResult = await dispatch(data, [toolCall], runId);
            return Continuation.resolve(dispatchResult.value.data);
        });

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: continueRunCommand
        };

        await worker.dispatch(request);
        const [, command] = capture(scheduler.schedule).last();
        command.should.deep.include({
            actionData: [
                "retrieve",
                {
                    name: "handBack",
                    messages: ["Message 1"]
                }
            ]
        });
    });

    it("processes continuation command when tools are suspended", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

        const toolDispatcher: ToolsContinuationDispatcher<Data> = imock();
        when(toolDispatcher.dispatchCommand(anything(), anything(), anything(), anything())).thenResolve(Continuation.suspend());
        when(toolContinuationDispatcherFactory.getDispatcher(anything(), anything())).thenReturn(instance(toolDispatcher));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: continueRunCommand
        };

        await worker.dispatch(request);
        verify(wrapper.processToolsResponse(anything(), anything(), anything(), anything, anything())).never();
        verify(scheduler.schedule(anything(), anything())).never();
    });

    it("processes retrieve command", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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
        updatedChatState.config.assistantConfig.should.deep.include({
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
                text: aiMessages[i - 2][1],
                meta: {
                    name: "ai"
                }
            });
        }

        verify(wrapper.getMessages(strictEqual(threadId), strictEqual(lastChatMessageId)));
    });

    it("processes retrieve command with provided middleware", async function() {
        await createChat(threadId, "processing", dispatchId);
        when(wrapper.getMessages(anything(), anything())).thenReturn(Promise.resolve({
            messages: aiMessages,
            latestMessageId: lastChatMessageId
        }));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: retrieveCommand
        };

        let middlewareCalled = false;

        createWorker(
            [
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
            ]
        );
        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.config.assistantConfig.should.deep.include({
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
                text: aiMessages[i - 2][1],
                meta: {
                    name: "ai"
                }
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        middlewareCalled.should.be.true;
    });

    it("message middleware inserts messages", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

        when(wrapper.getMessages(anything(), anything())).thenReturn(Promise.resolve({
            messages: aiMessages,
            latestMessageId: lastChatMessageId
        }));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: retrieveCommand
        };

        createWorker(
            [
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
            ]
        );
        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<OpenAiAssistantConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.config.assistantConfig.should.deep.include({
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
                text: aiMessages[i - 2][1],
                meta: {
                    name: "ai"
                }
            });
        }
    });

    it("processes switch to user command", async function() {
        await createChat(threadId, "processing", dispatchId);
        createWorker();

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

    it("runs cleanup handler", async function() {
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve(threadId));
        createWorker();

        const request: Request<OpenAiChatCommand> = {
            ...context,
            data: cleanupCommand
        };

        let handlerCalled = false;
        await worker.dispatch(request, () => {
            handlerCalled = true;
        });

        verify(wrapper.deleteThread(threadId)).once();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        handlerCalled.should.be.false;
    });

    it("doesn't update chat if state changes while processing", async function() {
        await createChat(threadId, "processing");
        createWorker();

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
        await createChat(undefined, "processing");
        createWorker();

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
        await createChat(undefined, "processing");
        createWorker();

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
        createWorker();

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: switchToUserCommand
        };
        await worker.dispatch(request);

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("complete");
    });

    it("sets run to retry on retry", async function() {
        await createChat(undefined, "processing");
        createWorker();

        when(wrapper.createThread(anything())).thenReject(new ChatError("internal", false, "AI error"));

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await worker.dispatch(request).catch(() => {});

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("waitingForRetry");
    });

    it("aborts if running in parallel", async function() {
        await createChat(threadId, "processing");
        createWorker();

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
        createWorker();

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
        await createChat(undefined, "processing");
        createWorker();

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));
        when(wrapper.deleteThread(anything())).thenReturn(Promise.resolve());

        const request: Request<OpenAiChatCommand> = {
            ...context,
            data: {
                engine: "openai",
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
        createWorker();

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<OpenAiChatCommand> = {
            ...context,
            data: {
                engine: "openai",
                commonData: commandData,
                actionData: ["create"]
            }
        };

        let handlerCalled = false;
        await worker.dispatch(request, () => {
            handlerCalled = true;
        });

        verify(wrapper.createThread(anything())).once();
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        handlerCalled.should.be.true;
    });

    it("runs hand-over command", async function() {
        when(commandScheduler.handOver(anything(), anything())).thenResolve();
        await createChat(undefined, "processing");
        createWorker();

        when(wrapper.createThread(anything())).thenReturn(Promise.resolve(threadId));

        const request: Request<OpenAiChatCommand> = {
            ...context,
            data: handoverCommand
        };

        const result = await worker.dispatch(request);

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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

        const request: Request<OpenAiChatCommand> = {
            ...context,
            data: handbackCommand
        };

        const result = await worker.dispatch(request);

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
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
