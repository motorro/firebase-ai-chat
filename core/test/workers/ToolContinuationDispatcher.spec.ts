import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {test} from "../functionsTest";
import {
    CHATS, chatState,
    commandData,
    data,
    Data,
    data2,
    data3,
    DispatchAction,
    dispatcherId,
    toolCall1,
    toolCall2
} from "../mock";
import {
    AssistantConfig,
    ChatState,
    Collections,
    Continuation,
    ContinuationCommand,
    ContinuationRequest,
    DispatchResult,
    getReducerSuccess,
    ToolCallsResult,
    ToolsDispatcher
} from "../../src";
import {
    SequentialToolsContinuationDispatchRunner,
    ToolsContinuationDispatchRunner
} from "../../src/aichat/workers/ToolsContinuationDispatchRunner";
import {ToolCallData, ToolsContinuationData} from "../../src/aichat/data/ContinuationCommand";
import {ToolsContinuationDispatcherImpl} from "../../src/aichat/workers/ToolsContinuationDispatcher";
import CollectionReference = admin.firestore.CollectionReference;
import DocumentReference = firestore.DocumentReference;
import FieldValue = firestore.FieldValue;

const db = firestore();
const chatDoc = db.collection(CHATS).doc() as DocumentReference<ChatState<AssistantConfig, Data>>;
const continuations = chatDoc.collection(Collections.continuations) as CollectionReference<ToolsContinuationData>;

describe("Tool continuation dispatcher", function() {
    after(async function() {
        test.cleanup();
    });

    beforeEach(async function() {
        await chatDoc.set(chatState);
    });

    afterEach(async function() {
        await db.recursiveDelete(chatDoc);
    });

    function createDispatcher(dispatcher: ToolsDispatcher<Data>): ToolsContinuationDispatcherImpl<DispatchAction, ContinuationCommand<DispatchAction>, Data> {
        const dispatchRunner: ToolsContinuationDispatchRunner<Data> = new SequentialToolsContinuationDispatchRunner<Data>({[dispatcherId]: dispatcher});
        return new ToolsContinuationDispatcherImpl(
            chatDoc.path,
            dispatcherId,
            db,
            dispatchRunner
        );
    }

    describe("dispatch", function() {
        it("processes all tool calls", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data2);
                return true;
            };

            const results = [
                {data: data2},
                data3
            ];
            let resultIndex = 0;

            const passedRequests: Array<ContinuationRequest> = [];

            const runner = createDispatcher(() => {
                return results[resultIndex++];
            });

            const result = await runner.dispatch(
                data,
                [toolCall1.call.request, toolCall2.call.request],
                updateChatData,
                (request) => {
                    passedRequests.push(request);
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            let resolvedData: ToolCallsResult<Data> | undefined = undefined;
            if (result.isResolved()) {
                resolvedData = result.value;
            }
            if (undefined === resolvedData) {
                throw new Error("Expecting resolved continuation");
            }

            resolvedData.should.deep.equal({
                data: data2,
                responses: [
                    {
                        toolCallId: toolCall1.call.request.toolCallId,
                        toolName: toolCall1.call.request.toolName,
                        response: {data: data2}
                    },
                    {
                        toolCallId: toolCall2.call.request.toolCallId,
                        toolName: toolCall2.call.request.toolName,
                        response: {result: data3}
                    }
                ]
            });
            dataUpdated.should.be.true;

            const continuation = (await continuations.doc(passedRequests[0].continuationId).get()).data();
            if (undefined !== continuation) {
                throw new Error("Expecting continuation not to be saved");
            }
        });

        it("saves continuation if tools are suspended", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data2);
                return true;
            };

            const results: ReadonlyArray<Continuation<DispatchResult<Data>>> = [
                Continuation.resolve(getReducerSuccess(data2)),
                Continuation.suspend()
            ];
            let resultIndex = 0;

            const passedRequests: Array<ContinuationRequest> = [];

            const dispatcher = createDispatcher(() => {
                return results[resultIndex++];
            });

            const result = await dispatcher.dispatch(
                data,
                [toolCall1.call.request, toolCall2.call.request],
                updateChatData,
                (request) => {
                    passedRequests.push(request);
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            result.isSuspended().should.be.true;

            const continuationDoc = continuations.doc(passedRequests[0].continuationId);
            const continuation = (await continuationDoc.get()).data();
            if (undefined === continuation) {
                throw new Error("Expecting saved continuation");
            }

            continuation.dispatcherId.should.be.deep.equal(dispatcherId);
            continuation.state.should.be.equal("suspended");
            dataUpdated.should.be.true;

            const savedTools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;
            const tool1 = (await savedTools.doc(passedRequests[0].tool.toolId).get()).data();
            if (undefined === tool1) {
                throw new Error("Expecting saved tool 1");
            }
            tool1.should.deep.equal({
                index: 0,
                call: {
                    request: {
                        toolCallId: "call1",
                        toolName: "callOne",
                        args: {a: 1}
                    },
                    response: {
                        data: data2
                    }
                }
            });
            const tool2 = (await savedTools.doc(passedRequests[1].tool.toolId).get()).data();
            if (undefined === tool2) {
                throw new Error("Expecting saved tool 2");
            }
            tool2.should.deep.equal({
                index: 1,
                call: {
                    request: {
                        toolCallId: "call2",
                        toolName: "callTwo",
                        args: {a: 2}
                    },
                    response: null
                }
            });
        });
    });

    /**
     * Runs dispatcher and MERGES data
     */
    describe("dispatchCommand", function() {
        const continuationDoc = continuations.doc();
        const tools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;

        async function createCommand(results: ReadonlyArray<DispatchResult<Data>> = []): Promise<ContinuationCommand<DispatchAction>> {
            const source = [toolCall1, toolCall2];
            let request: ContinuationRequest | undefined = undefined;
            let i = 0;
            for (const tool of source) {
                const toolDoc = tools.doc();
                await toolDoc.set(results[i] ? {...tool, call: {...tool.call, response: results[i]}} : tool);
                request = {
                    continuationId: continuationDoc.id,
                    tool: {
                        toolId: toolDoc.id
                    }
                };
                ++i;
            }
            if (undefined === request) {
                throw new Error("No request");
            }

            await continuationDoc.set({
                dispatcherId: dispatcherId,
                state: "suspended",
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            return {
                commonData: commandData,
                actionData: "create",
                continuation: request
            };
        }

        it("processes all tool calls", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data2);
                return true;
            };

            const command = await createCommand();
            const results = [
                {data: data2},
                data3
            ];
            let resultIndex = 0;

            const passedRequests: Array<ContinuationRequest> = [];

            const dispatcher = createDispatcher(() => {
                return results[resultIndex++];
            });

            const result = await dispatcher.dispatchCommand(
                data,
                command,
                updateChatData,
                (request) => {
                    passedRequests.push(request);
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            let resolvedData: ToolCallsResult<Data> | undefined = undefined;
            if (result.isResolved()) {
                resolvedData = result.value;
            }
            if (undefined === resolvedData) {
                throw new Error("Expecting resolved continuation");
            }

            resolvedData.should.deep.equal({
                data: data2,
                responses: [
                    {
                        toolCallId: toolCall1.call.request.toolCallId,
                        toolName: toolCall1.call.request.toolName,
                        response: {data: data2}
                    },
                    {
                        toolCallId: toolCall2.call.request.toolCallId,
                        toolName: toolCall2.call.request.toolName,
                        response: {result: data3}
                    }
                ]
            });

            const continuation = (await continuationDoc.get()).data();
            if (undefined === continuation) {
                throw new Error("Expecting saved continuation");
            }

            continuation.dispatcherId.should.be.deep.equal(dispatcherId);
            continuation.state.should.be.equal("resolved");
            dataUpdated.should.be.true;

            const savedTools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;
            const tool1 = (await savedTools.doc(passedRequests[0].tool.toolId).get()).data();
            if (undefined === tool1) {
                throw new Error("Expecting saved tool 1");
            }
            tool1.should.deep.equal({
                index: 1,
                call: {
                    request: {
                        toolCallId: "call1",
                        toolName: "callOne",
                        args: {a: 1}
                    },
                    response: {
                        data: data2
                    }
                }
            });
            const tool2 = (await savedTools.doc(passedRequests[1].tool.toolId).get()).data();
            if (undefined === tool2) {
                throw new Error("Expecting saved tool 2");
            }
            tool2.should.deep.equal({
                index: 2,
                call: {
                    request: {
                        toolCallId: "call2",
                        toolName: "callTwo",
                        args: {a: 2}
                    },
                    response: {
                        result: data3
                    }
                }
            });
        });

        it("saves next tools when suspended", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data2);
                return true;
            };

            const command = await createCommand();
            const results: ReadonlyArray<Continuation<DispatchResult<Data>>> = [
                Continuation.resolve(getReducerSuccess(data2)),
                Continuation.suspend()
            ];
            let resultIndex = 0;

            const passedRequests: Array<ContinuationRequest> = [];

            const runner = createDispatcher(() => {
                return results[resultIndex++];
            });

            const result = await runner.dispatchCommand(
                data,
                command,
                updateChatData,
                (request) => {
                    passedRequests.push(request);
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            result.isSuspended().should.be.true;

            const continuation = (await continuationDoc.get()).data();
            if (undefined === continuation) {
                throw new Error("Expecting saved continuation");
            }

            continuation.dispatcherId.should.be.deep.equal(dispatcherId);
            continuation.state.should.be.equal("suspended");
            dataUpdated.should.be.true;

            const savedTools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;
            const tool1 = (await savedTools.doc(passedRequests[0].tool.toolId).get()).data();
            if (undefined === tool1) {
                throw new Error("Expecting saved tool 1");
            }
            tool1.should.deep.equal({
                index: 1,
                call: {
                    request: {
                        toolCallId: "call1",
                        toolName: "callOne",
                        args: {a: 1}
                    },
                    response: {
                        data: data2
                    }
                }
            });
            const tool2 = (await savedTools.doc(passedRequests[1].tool.toolId).get()).data();
            if (undefined === tool2) {
                throw new Error("Expecting saved tool 2");
            }
            tool2.should.deep.equal({
                index: 2,
                call: {
                    request: {
                        toolCallId: "call2",
                        toolName: "callTwo",
                        args: {a: 2}
                    },
                    response: null
                }
            });
        });

        it("completes and resolves continuation", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data3);
                return true;
            };

            const command = await createCommand([
                {
                    data: data2
                }
            ]);
            const results: ReadonlyArray<Continuation<DispatchResult<Data>>> = [
                Continuation.resolve(getReducerSuccess(data3))
            ];
            let resultIndex = 0;

            const passedRequests: Array<ContinuationRequest> = [];

            const runner = createDispatcher(() => {
                return results[resultIndex++];
            });

            const result = await runner.dispatchCommand(
                data2,
                command,
                updateChatData,
                (request) => {
                    passedRequests.push(request);
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            let resolvedData: ToolCallsResult<Data> | undefined = undefined;
            if (result.isResolved()) {
                resolvedData = result.value;
            }
            if (undefined === resolvedData) {
                throw new Error("Expecting resolved continuation");
            }

            resolvedData.should.deep.equal({
                data: data3,
                responses: [
                    {
                        toolCallId: toolCall1.call.request.toolCallId,
                        toolName: toolCall1.call.request.toolName,
                        response: {data: data2}
                    },
                    {
                        toolCallId: toolCall2.call.request.toolCallId,
                        toolName: toolCall2.call.request.toolName,
                        response: {data: data3}
                    }
                ]
            });

            const continuation = (await continuationDoc.get()).data();
            if (undefined === continuation) {
                throw new Error("Expecting saved continuation");
            }

            continuation.dispatcherId.should.be.deep.equal(dispatcherId);
            continuation.state.should.be.equal("resolved");
            dataUpdated.should.be.true;

            const savedTools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;
            const tool2 = (await savedTools.doc(passedRequests[0].tool.toolId).get()).data();
            if (undefined === tool2) {
                throw new Error("Expecting saved tool 2");
            }
            tool2.should.deep.equal({
                index: 2,
                call: {
                    request: {
                        toolCallId: "call2",
                        toolName: "callTwo",
                        args: {a: 2}
                    },
                    response: {
                        data: data3
                    }
                }
            });
        });

        it("processes fully resolved continuation", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data3);
                return true;
            };

            const command = await createCommand([
                {
                    data: data2
                },
                {
                    data: data3
                }
            ]);

            const runner = createDispatcher(() => {
                throw new Error("Unexpected dispatch");
            });

            const result = await runner.dispatchCommand(
                data3,
                command,
                updateChatData,
                (request) => {
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            let resolvedData: ToolCallsResult<Data> | undefined = undefined;
            if (result.isResolved()) {
                resolvedData = result.value;
            }
            if (undefined === resolvedData) {
                throw new Error("Expecting resolved continuation");
            }

            resolvedData.should.deep.equal({
                data: data3,
                responses: [
                    {
                        toolCallId: toolCall1.call.request.toolCallId,
                        toolName: toolCall1.call.request.toolName,
                        response: {data: data2}
                    },
                    {
                        toolCallId: toolCall2.call.request.toolCallId,
                        toolName: toolCall2.call.request.toolName,
                        response: {data: data3}
                    }
                ]
            });
            dataUpdated.should.be.true;
        });

        it("processes failed continuation", async function() {
            let dataUpdated = false;
            const updateChatData: (data: Data) => Promise<boolean> = async (data) => {
                dataUpdated = true;
                data.should.deep.equal(data2);
                return true;
            };

            const command = await createCommand([
                {
                    data: data2
                },
                {
                    error: "Error"
                }
            ]);

            const runner = createDispatcher(() => {
                throw new Error("Unexpected dispatch");
            });

            const result = await runner.dispatchCommand(
                data2,
                command,
                updateChatData,
                (request) => {
                    return {
                        commonData: commandData,
                        actionData: "close",
                        continuation: request
                    };
                }
            );

            let resolvedData: ToolCallsResult<Data> | undefined = undefined;
            if (result.isResolved()) {
                resolvedData = result.value;
            }
            if (undefined === resolvedData) {
                throw new Error("Expecting resolved continuation");
            }

            resolvedData.should.deep.equal({
                data: data2,
                responses: [
                    {
                        toolCallId: toolCall1.call.request.toolCallId,
                        toolName: toolCall1.call.request.toolName,
                        response: {data: data2}
                    },
                    {
                        toolCallId: toolCall2.call.request.toolCallId,
                        toolName: toolCall2.call.request.toolName,
                        response: {error: "Error"}
                    }
                ]
            });
            dataUpdated.should.be.true;
        });
    });
});
