import {anything, deepEqual, imock, instance, mock, reset, verify, when} from "@johanblumenberg/ts-mockito";
import {ChatSession, Content, GenerativeModel} from "@google-cloud/vertexai";
import {ToolsDispatcher} from "@motorro/firebase-ai-chat-core";
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
    let instructions: VertexAiSystemInstructions<Data>;

    function createDispatcher(success = true) {
        let dispatcher: ToolsDispatcher<Data>;
        if (success) {
            dispatcher = () => Promise.resolve(data2);
        } else {
            dispatcher = () => Promise.reject(new Error("Error"));
        }
        instructions = {
            instructions: instructions1,
            tools: {
                dispatcher: dispatcher,
                definition: toolsDefinition
            }
        };
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
            data
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(2);
        const tm1 = threadMessages[0][1];
        tm1.content.should.deep.equal({
            role: "user",
            parts: [{
                text: "M1"
            }]
        });
        const tm2 = threadMessages[1][1];
        tm2.content.should.deep.equal({
            role: "model",
            parts: [{
                text: "Message 1"
            }]
        });

        result.data.should.deep.equal(data);
        const resultMessages = result.messages;
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
        createDispatcher();
        const thread = await wrapper.createThread({a: "b"});
        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(4);
        const tm1 = threadMessages[0][1];
        tm1.content.should.deep.equal({
            role: "user",
            parts: [{
                text: "M1"
            }]
        });
        const tm2 = threadMessages[1][1];
        tm2.content.should.deep.equal({
            role: "model",
            parts: [{
                functionCall: {name: "someFun", args: {a: "b"}}
            }]
        });
        const tm3 = threadMessages[2][1];
        tm3.content.should.deep.equal({
            role: "user",
            parts: [{
                functionResponse: {name: "someFun", response: {data: data2}}
            }]
        });
        const tm4 = threadMessages[3][1];
        tm4.content.should.deep.equal({
            role: "model",
            parts: [{
                text: "Message 1"
            }]
        });

        result.data.should.deep.equal(data2);
        const resultMessages = result.messages;
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

    it("runs tools and returns dispatch error", async function() {
        createWrapper([toolCalls, messages]);
        createDispatcher(false);
        const thread = await wrapper.createThread({a: "b"});
        const result = await wrapper.postMessage(
            thread,
            instructions,
            ["M1"],
            data
        );

        const threadMessages = await wrapper.getThreadMessages(thread);
        threadMessages.length.should.equal(4);
        const tm1 = threadMessages[0][1];
        tm1.content.should.deep.equal({
            role: "user",
            parts: [{
                text: "M1"
            }]
        });
        const tm2 = threadMessages[1][1];
        tm2.content.should.deep.equal({
            role: "model",
            parts: [{
                functionCall: {name: "someFun", args: {a: "b"}}
            }]
        });
        const tm3 = threadMessages[2][1];
        tm3.content.should.deep.equal({
            role: "user",
            parts: [{
                functionResponse: {name: "someFun", response: {error: "Error"}}
            }]
        });
        const tm4 = threadMessages[3][1];
        tm4.content.should.deep.equal({
            role: "model",
            parts: [{
                text: "Message 1"
            }]
        });

        result.data.should.deep.equal(data);
        const resultMessages = result.messages;
        resultMessages.length.should.deep.equal(1);
        const m1 = resultMessages[0];
        m1.should.deep.include({
            id: threadMessages[3][0],
            author: "ai",
            text: "Message 1"
        });

        verify(session.sendMessage(deepEqual([{text: "M1"}]))).once();
        verify(session.sendMessage(deepEqual([{functionResponse: {name: "someFun", response: {error: "Error"}}}]))).once();
    });

    it("closes thread", async function() {
        createWrapper();
        createDispatcher();
        const threadDoc = threads.doc();
        await threadDoc.set({meta: {a: "b"}});
        await wrapper.deleteThread(threadDoc.id);
        (await threadDoc.get()).exists.should.be.false;
    });
});
