import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {test} from "../functionsTest";
import {
    CHATS, chatState,
    data,
    Data,
    data2,
    data3,
    DispatchAction,
    dispatcherId,
    toolCall1,
    toolCall2, userId
} from "../mock";
import {
    AssistantConfig,
    ChatState,
    Collections,
    ContinuationCommand,
    ContinuationRequest,
    DispatchResult, getFunctionSuccess,
    getReducerSuccess,
    TaskScheduler
} from "../../src";
import {ToolCallData, ToolsContinuationData} from "../../src/aichat/data/ContinuationCommand";
import {anything, imock, instance, reset, verify, when} from "@johanblumenberg/ts-mockito";
import {
    ToolsContinuationSchedulerImpl,
    ToolsContinuationScheduler
} from "../../src/aichat/workers/ToolsContinuationScheduler";
import {beforeEach} from "mocha";
import CollectionReference = admin.firestore.CollectionReference;
import DocumentReference = firestore.DocumentReference;
import FieldValue = firestore.FieldValue;

const queueName = "chats";
const db = firestore();
const chatDoc = db.collection(CHATS).doc() as DocumentReference<ChatState<AssistantConfig, Data>>;
const continuations = chatDoc.collection(Collections.continuations) as CollectionReference<ToolsContinuationData>;
const continuationDoc = continuations.doc();
const tools = continuationDoc.collection(Collections.toolCalls) as CollectionReference<ToolCallData<Data>>;

describe("Tool continuation scheduler", function() {
    let tScheduler: TaskScheduler;
    let cScheduler: ToolsContinuationScheduler<Data>;

    before(function() {
        tScheduler = imock();
    });

    beforeEach(async function() {
        await chatDoc.set(chatState);
        cScheduler = new ToolsContinuationSchedulerImpl(queueName, firestore(), instance(tScheduler));
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        await db.recursiveDelete(chatDoc);
        reset(tScheduler);
    });

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
            commonData: {
                ownerId: userId,
                chatDocumentPath: chatDoc.path,
                dispatchId: "dispatchId",
                meta: null
            },
            actionData: "create",
            continuation: request
        };
    }

    it("updates tool call with result", async function() {
        const command = await createCommand([getReducerSuccess(data2)]);
        when(tScheduler.schedule(anything(), anything(), anything())).thenResolve();

        await cScheduler.continue(command, getFunctionSuccess(data3));

        const continuation = (await continuationDoc.get()).data();
        if (undefined === continuation) {
            throw new Error("Expecting saved continuation");
        }

        continuation.dispatcherId.should.be.deep.equal(dispatcherId);

        const savedTools = (await tools.orderBy("index").get()).docs;
        const tool1 = savedTools[0]?.data();
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
        const tool2 = savedTools[1]?.data();
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

        verify(tScheduler.schedule(queueName, command)).once();

        const chatData = (await chatDoc.get()).data();
        if (undefined === chatData) {
            throw new Error("Expecting chat data");
        }
        chatData.data.should.deep.equal(data);
    });

    it("updates tool call with data", async function() {
        const command = await createCommand([getReducerSuccess(data2)]);
        when(tScheduler.schedule(anything(), anything(), anything())).thenResolve();

        await cScheduler.continue(command, getReducerSuccess(data3));

        const continuation = (await continuationDoc.get()).data();
        if (undefined === continuation) {
            throw new Error("Expecting saved continuation");
        }

        continuation.dispatcherId.should.be.deep.equal(dispatcherId);

        const savedTools = (await tools.orderBy("index").get()).docs;
        const tool1 = savedTools[0]?.data();
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
        const tool2 = savedTools[1]?.data();
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

        verify(tScheduler.schedule(queueName, command)).once();

        const chatData = (await chatDoc.get()).data();
        if (undefined === chatData) {
            throw new Error("Expecting chat data");
        }
        chatData.data.should.deep.equal(data3);
    });

    it("does not update data if dispatched with another id", async function() {
        let command = await createCommand([getReducerSuccess(data2)]);
        command = {
            ...command,
            commonData: {
                ...command.commonData,
                dispatchId: "otherId"
            }
        };
        when(tScheduler.schedule(anything(), anything(), anything())).thenResolve();

        await cScheduler.continue(command, getReducerSuccess(data3));

        const chatData = (await chatDoc.get()).data();
        if (undefined === chatData) {
            throw new Error("Expecting chat data");
        }
        chatData.data.should.deep.equal(data);
    });

    it("fails if tool call already updated", async function() {
        const command = await createCommand([getReducerSuccess(data2), getReducerSuccess(data3)]);
        when(tScheduler.schedule(anything(), anything(), anything())).thenResolve();

        return cScheduler.continue(command, getReducerSuccess(data))
            .should
            .eventually
            .be.rejectedWith("Inconsistent tool calls. Tool call already fulfilled");
    });
});
