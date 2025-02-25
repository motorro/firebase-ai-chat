import {anything, deepEqual, imock, instance, mock, reset, verify, when} from "@johanblumenberg/ts-mockito";
import {ChatSession, Content, GenerativeModel} from "@google-cloud/vertexai";
import {
    Continuation,
    getReducerSuccess,
    ToolCallRequest,
    ToolCallsResult, ToolContinuationSoFar
} from "@motorro/firebase-ai-chat-core";
import {Data, data, data2, instructions1, toolsDefinition} from "./mock";
import {VertexAiSystemInstructions} from "../src";
import {db} from "./functionsTest";
import {firestore} from "firebase-admin";
import {Thread} from "../src/aichat/data/Thread";
import CollectionReference = firestore.CollectionReference;
import {VertexAiWrapper} from "../src/aichat/VertexAiWrapper";

const messages: Content = {
    role: "model",
    parts: [
        {
            text: "Message 1"
        }
    ]
};
const toolCalls: Content = {
    role: "model",
    parts: [{
        functionCall: {name: "someFun", args: {a: "b"}}
    }]
};

describe("VertexAI wrapper", function() {
    const threads = db.collection("threads") as CollectionReference<Thread>;
    let session: ChatSession;
    let wrapper: VertexAiWrapper;
    let dispatcher: (data: ToolContinuationSoFar<Data>, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<Data>>>;

    const instructions: VertexAiSystemInstructions<Data> = {
        instructions: instructions1,
        tools: {
            dispatcher: () => ({error: "Unexpected instructions dispatch"}),
            definition: toolsDefinition
        }
    };

    function createDispatcher() {
        dispatcher = () => Promise.resolve(Continuation.resolve({
            data: data,
            responses: [],
            handOver: null
        }));
    }

    function createWrapper(response: ReadonlyArray<Content> = [{role: "model", parts: []}]) {
        const vertexAi: GenerativeModel = imock();
        session = mock(ChatSession);
        const reply = response.map((it) => ({
            response: {
                candidates: [{
                    index: 0,
                    content: it
                }]
            }
        }));
        when(session.sendMessage(anything())).thenResolve(reply[0], ...reply.slice(1, reply.length));
        when(vertexAi.startChat(anything())).thenReturn(instance(session));
        wrapper = new VertexAiWrapper(instance(vertexAi), db, threads.path);
    }

    afterEach(async function() {
        await db.recursiveDelete(threads);
        reset(session);
    });

    it("creates thread", async function() {
        createWrapper();
        createDispatcher();
        const id = await wrapper.createThread({a: "b"});
        const threadDoc = threads.doc(id);
        const data = (await threadDoc.get()).data();
        if (undefined === data) {
            throw new Error("Thread is not created");
        }
        data.should.deep.include({meta: {a: "b"}});
    });

    it("posts message", async function() {
        createWrapper([messages]);
        createDispatcher();
        const thread = await wrapper.createThread({a: "b"});
        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data,
            dispatcher
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(2);
        const tm1 = threadMessages[0][1];
        tm1.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    text: "M1"
                }]
            }
        });
        const tm2 = threadMessages[1][1];
        tm2.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    text: "Message 1"
                }]
            }
        });

        if (result.isResolved()) {
            result.value.should.deep.include({
                data: data
            });
            result.value.messages.should.have.lengthOf(1);
            result.value.messages[0].should.include({
                author: "ai",
                text: "Message 1"
            });
        } else {
            throw new Error("Expecting resolved continuation");
        }

        result.value.data.should.deep.equal(data);
        const resultMessages = result.value.messages;
        resultMessages.length.should.deep.equal(1);
        const m1 = resultMessages[0];
        m1.should.deep.include({
            id: threadMessages[1][0],
            author: "ai",
            text: "Message 1"
        });

        verify(session.sendMessage(deepEqual([{text: "M1"}]))).once();
    });

    it("posts message and runs tools", async function() {
        createWrapper([toolCalls, messages]);
        const thread = await wrapper.createThread({a: "b"});

        const toolResponse: ToolCallsResult<Data> = {
            data: data2,
            responses: [{
                toolCallId: "someFun",
                toolName: "someFun",
                response: getReducerSuccess(data2)
            }],
            handOver: null
        };
        dispatcher = (d, tc) => {
            d.should.deep.equal({data, handOver: null});
            tc.should.deep.equal([{
                toolCallId: "someFun",
                toolName: "someFun",
                args: {a: "b"}
            }]);
            return Promise.resolve(Continuation.resolve(toolResponse));
        };

        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data,
            dispatcher
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(4);
        const tm1 = threadMessages[0][1];
        tm1.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    text: "M1"
                }]
            }
        });
        const tm2 = threadMessages[1][1];
        tm2.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    functionCall: {name: "someFun", args: {a: "b"}}
                }]
            }
        });
        const tm3 = threadMessages[2][1];
        tm3.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    functionResponse: {name: "someFun", response: {data: data2}}
                }]
            }
        });
        const tm4 = threadMessages[3][1];
        tm4.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    text: "Message 1"
                }]
            }
        });

        if (result.isResolved()) {
            result.value.should.deep.include({
                data: data2
            });
        } else {
            throw new Error("Expecting resolved continuation");
        }

        result.value.data.should.deep.equal(data2);
        const resultMessages = result.value.messages;
        resultMessages.length.should.deep.equal(1);
        const m1 = resultMessages[0];
        m1.should.deep.include({
            id: threadMessages[3][0],
            author: "ai",
            text: "Message 1"
        });

        verify(session.sendMessage(deepEqual([{text: "M1"}]))).once();
        verify(session.sendMessage(deepEqual([{functionResponse: {name: "someFun", response: {data: data2}}}]))).once();
    });

    it("posts message and suspends tools", async function() {
        createWrapper([toolCalls, messages]);
        const thread = await wrapper.createThread({a: "b"});

        dispatcher = () => {
            return Promise.resolve(Continuation.suspend());
        };

        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data,
            dispatcher
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(2);
        const tm1 = threadMessages[0][1];
        tm1.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    text: "M1"
                }]
            }
        });
        const tm2 = threadMessages[1][1];
        tm2.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    functionCall: {name: "someFun", args: {a: "b"}}
                }]
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        result.isSuspended().should.be.true;
    });

    it("runs tools with gemini error", async function() {
        const toolCalls: Content = {
            role: "model",
            parts: [{
                // @ts-expect-error Gemini creates a call with empty name from time to time
                functionCall: {args: {a: "b"}}
            }]
        };

        createWrapper([toolCalls, messages]);
        createDispatcher();
        const thread = await wrapper.createThread({a: "b"});
        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data,
            dispatcher
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(4);
        const tm1 = threadMessages[0][1];
        tm1.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    text: "M1"
                }]
            }
        });
        const tm2 = threadMessages[1][1];
        tm2.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    functionCall: {args: {a: "b"}}
                }]
            }
        });
        const tm3 = threadMessages[2][1];
        tm3.candidate.should.deep.include({
            content: {
                role: "user",
                parts: [{
                    functionResponse: {
                        name: "function name was not provided",
                        response: {
                            error: "You didn't supply a function name. Check tools definition and supply a function name!"
                        }
                    }
                }]
            }
        });
        const tm4 = threadMessages[3][1];
        tm4.candidate.should.deep.include({
            content: {
                role: "model",
                parts: [{
                    text: "Message 1"
                }]
            }
        });

        if (result.isResolved()) {
            result.value.should.deep.include({
                data: data
            });
        } else {
            throw new Error("Expecting resolved continuation");
        }

        result.value.data.should.deep.equal(data);
        const resultMessages = result.value.messages;
        resultMessages.length.should.deep.equal(1);
        const m1 = resultMessages[0];
        m1.should.deep.include({
            id: threadMessages[3][0],
            author: "ai",
            text: "Message 1"
        });

        verify(session.sendMessage(deepEqual([{text: "M1"}]))).once();
        verify(session.sendMessage(deepEqual([
            {
                functionResponse: {
                    name: "function name was not provided",
                    response: {
                        error: "You didn't supply a function name. Check tools definition and supply a function name!"
                    }
                }
            }
        ]))).once();
    });

    it("closes thread", async function() {
        createWrapper();
        createDispatcher();
        const threadDoc = threads.doc();
        await threadDoc.set({meta: {a: "b"}});
        await wrapper.deleteThread(threadDoc.id);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (await threadDoc.get()).exists.should.be.false;
    });
});
