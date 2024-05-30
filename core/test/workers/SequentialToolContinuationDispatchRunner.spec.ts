import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {test} from "../functionsTest";
import {
    CHATS,
    commandData,
    continuationData,
    data,
    Data,
    data2, data3,
    DispatchAction,
    dispatcherId,
    toolCall1, toolCall2, userId
} from "../mock";
import {
    AssistantConfig,
    ChatDispatchData, ChatState,
    Collections,
    Continuation,
    ContinuationCommand, ContinuationRequestToolData,
    DispatchResult,
    getReducerSuccess,
    ToolsDispatcher
} from "../../src";
import {
    commonFormatContinuationError, SequentialToolsContinuationDispatchRunner,
    ToolsContinuationDispatchRunner
} from "../../src/aichat/workers/ToolsContinuationDispatchRunner";
import {ToolCallData, ToolsContinuationData} from "../../src/aichat/data/ContinuationCommand";
import CollectionReference = admin.firestore.CollectionReference;
import DocumentReference = firestore.DocumentReference;
import {afterEach} from "mocha";

const db = firestore();
const chatDoc = db.collection(CHATS).doc() as DocumentReference<ChatState<AssistantConfig, Data>>;
const continuations = chatDoc.collection(Collections.continuations) as CollectionReference<ToolsContinuationData<Data>>;
const continuationDoc = continuations.doc();
const toolCalls = continuationDoc.collection(Collections.continuations) as CollectionReference<ToolCallData<Data>>;

const toolCall1Id = toolCalls.doc();
const toolCall2Id = toolCalls.doc();

const continuationCommand1: ContinuationCommand<DispatchAction> = {
    commonData: commandData,
    actionData: "close",
    continuation: {
        continuationId: continuationDoc.id,
        tool: {
            toolId: toolCall1Id.id
        }
    }
};
const continuationCommand2: ContinuationCommand<DispatchAction> = {
    commonData: commandData,
    actionData: "close",
    continuation: {
        continuationId: continuationDoc.id,
        tool: {
            toolId: toolCall2Id.id
        }
    }
};
export const chatData: ChatDispatchData = {
    ownerId: userId,
    chatDocumentPath: chatDoc.path,
    meta: {
        userMessageMeta: {
            name: "Vasya"
        }
    }
}


describe("Tool continuation dispatch runner", function() {
    after(async function() {
        test.cleanup();
    });
    afterEach(async function() {
        await db.recursiveDelete(chatDoc);
    })

    function createRunner(dispatcher: ToolsDispatcher<Data>): ToolsContinuationDispatchRunner<Data> {
        return new SequentialToolsContinuationDispatchRunner<Data>({[dispatcherId]: dispatcher});
    }

    it("processes tool calls returning value", async function() {
        const runner = createRunner(() => {
            return data2;
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {result: data2}}}
                ]
            ]
        });
    });

    it("processes tool calls returning DispatchResult", async function() {
        const runner = createRunner(() => {
            return getReducerSuccess(data2, "comment");
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data2,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {data: data2, comment: "comment"}}}
                ]
            ]
        });
    });

    it("processes tool calls returning Continuation", async function() {
        const runner = createRunner(() => {
            return Continuation.resolve(data2);
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {result: data2}}}
                ]
            ]
        });
    });

    it("processes tool calls returning Continuation of dispatch result", async function() {
        const runner = createRunner(() => {
            return Continuation.resolve(getReducerSuccess(data2, "comment"));
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data2,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {data: data2, comment: "comment"}}}
                ]
            ]
        });
    });

    it("processes failing tool calls", async function() {
        const runner = createRunner(() => {
            return Promise.reject(new Error("Error"));
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {error: "Error"}}}
                ]
            ]
        });
    });

    it("processes all tool calls", async function() {
        const results = [
            {data: data2},
            data3
        ];
        let resultIndex = 0;

        const commands = [
            continuationCommand1,
            continuationCommand2
        ];
        let commandIndex = 0;

        const passedData: Array<Data> = [];
        const passedNames: Array<string> = [];
        const passedArgs: Array<Record<string, unknown>> = [];
        const passedContinuations: Array<ContinuationCommand<unknown>> = [];
        const passedToolCalls: Array<ContinuationRequestToolData> = [];
        const runner = createRunner((data, name, args, continuation) => {
            passedData.push(data);
            passedNames.push(name);
            passedArgs.push(args);
            passedContinuations.push(continuation);
            return results[resultIndex++];
        });

        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1], [toolCall2Id, toolCall2]],
            chatData,
            (toolCall) => {
                passedToolCalls.push(toolCall);
                return commands[commandIndex++];
            }
        );
        result.should.deep.equal({
            suspended: false,
            data: data2,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {data: data2}}}
                ],
                [
                    toolCall2Id,
                    {...toolCall2, call: {...toolCall2.call, response: {result: data3}}}
                ]
            ]
        });

        passedData.should.deep.equal([data, data2]);
        passedNames.should.deep.equal(["callOne", "callTwo"]);
        passedArgs.should.deep.equal([{a: 1}, {a: 2}]);
        passedContinuations.should.deep.equal(commands);
        passedToolCalls.should.deep.equal([
            {toolId: toolCall1Id.id},
            {toolId: toolCall2Id.id}
        ]);
    });

    it("processes failing tool calls", async function() {
        const runner = createRunner(() => {
            return Promise.reject(new Error("Error"));
        });
        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1]],
            chatData,
            () => continuationCommand1
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {error: "Error"}}}
                ]
            ]
        });
    });

    it("suspends further tool calls if suspended", async function() {
        const results: ReadonlyArray<Continuation<DispatchResult<Data>>> = [
            Continuation.suspend(),
            Continuation.resolve(getReducerSuccess(data2))
        ];
        let resultIndex = 0;

        const commands = [
            continuationCommand1,
            continuationCommand2
        ];
        let commandIndex = 0;


        const runner = createRunner(() => {
            return results[resultIndex++];
        });

        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1], [toolCall2Id, toolCall2]],
            chatData,
            () => commands[commandIndex++]
        );
        result.should.deep.equal({
            suspended: true,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    toolCall1
                ],
                [
                    toolCall2Id,
                    toolCall2
                ]
            ]
        });
    });

    it("suspends tool calls if suspended", async function() {
        const results: ReadonlyArray<Continuation<DispatchResult<Data>>> = [
            Continuation.resolve(getReducerSuccess(data2)),
            Continuation.suspend()
        ];
        let resultIndex = 0;

        const commands = [
            continuationCommand1,
            continuationCommand2
        ];
        let commandIndex = 0;


        const runner = createRunner(() => {
            return results[resultIndex++];
        });

        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1], [toolCall2Id, toolCall2]],
            chatData,
            () => commands[commandIndex++]
        );
        result.should.deep.equal({
            suspended: true,
            data: data2,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {data: data2}}}
                ],
                [
                    toolCall2Id,
                    toolCall2
                ]
            ]
        });
    });

    it("fails subsequent calls if one of them fails", async function() {
        const commands = [
            continuationCommand1
        ];
        let commandIndex = 0;

        let calls = 0;
        const runner = createRunner(() => {
            ++calls;
            return {error: "Error"};
        });

        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, toolCall1], [toolCall2Id, toolCall2]],
            chatData,
            () => {
                return commands[commandIndex++];
            }
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {error: "Error"}}}
                ],
                [
                    toolCall2Id,
                    {...toolCall2, call: {...toolCall2.call, response: commonFormatContinuationError(toolCall1.call.request)}}
                ]
            ]
        });
        calls.should.be.equal(1);
    });

    it("fails subsequent calls if one of processed has failed", async function() {
        const commands = [
            continuationCommand1
        ];
        let commandIndex = 0;

        let calls = 0;
        const runner = createRunner(() => {
            throw new Error("Unexpected dispatch");
        });

        const result = await runner.dispatch(
            continuationData,
            [[toolCall1Id, {...toolCall1, call: {...toolCall1.call, response: {error: "Error"}}}], [toolCall2Id, toolCall2]],
            chatData,
            () => {
                return commands[commandIndex++];
            }
        );
        result.should.deep.equal({
            suspended: false,
            data: data,
            tools: [
                [
                    toolCall1Id,
                    {...toolCall1, call: {...toolCall1.call, response: {error: "Error"}}}
                ],
                [
                    toolCall2Id,
                    {...toolCall2, call: {...toolCall2.call, response: commonFormatContinuationError(toolCall1.call.request)}}
                ]
            ]
        });
        calls.should.be.equal(0);
    });
});
