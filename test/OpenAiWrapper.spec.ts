import {anything, capture, deepEqual, instance, imock, reset, strictEqual, verify, when} from "@johanblumenberg/ts-mockito";
import OpenAI from "openai";
import {AiWrapper, OpenAiWrapper, ToolsDispatcher} from "../src";
import {Threads} from "openai/resources/beta";
import Beta = OpenAI.Beta;
import Messages = Threads.Messages;
import ThreadMessage = Threads.ThreadMessage;
import {assistantId, Data, data, runId, threadId} from "./mock";
import Runs = Threads.Runs;
import Run = Threads.Run;
import {ThreadMessagesPage} from "openai/resources/beta/threads";
import {AbstractPage} from "openai/core";

const message1: ThreadMessage = {
    assistant_id: assistantId,
    content: [{
        type: "text",
        text: {
            annotations: [],
            value: "Message 1"
        }
    }],
    created_at: 1,
    file_ids: [],
    id: "m1",
    metadata: null,
    object: "thread.message",
    role: "assistant",
    run_id: runId,
    thread_id: threadId
};
const message2: ThreadMessage = {
    assistant_id: assistantId,
    content: [{
        type: "text",
        text: {
            annotations: [],
            value: "Message 2"
        }
    }],
    created_at: 2,
    file_ids: [],
    id: "m2",
    metadata: null,
    object: "thread.message",
    role: "assistant",
    run_id: runId,
    thread_id: threadId
};

describe("OpenAI wrapper", function() {
    const testDispatcher: ToolsDispatcher<Data> = () => Promise.resolve({value: "dispatched"});
    let wrapper: AiWrapper;
    let threads: Threads;
    let messages: Messages;
    let runs: Runs;

    beforeEach(async function() {
        const openAi: OpenAI = imock();
        const beta: Beta = imock();
        threads = imock();
        messages = imock();
        runs = imock();
        when(threads.messages).thenReturn(instance(messages));
        when(threads.runs).thenReturn(instance(runs));
        when(beta.threads).thenReturn(instance(threads));
        when(openAi.beta).thenReturn(instance(beta));

        wrapper = new OpenAiWrapper(instance(openAi));
    });

    afterEach(async function() {
        reset(messages);
        reset(runs);
        reset(threads);
    });

    it("creates thread", async function() {
        when(threads.create(anything())).thenResolve({
            object: "thread",
            id: "threadId",
            created_at: 0,
            metadata: {}
        });
        const id = await wrapper.createThread({a: "b"});
        id.should.be.equal("threadId");
        const [args] = capture(threads.create).last();
        if (undefined === args) {
            throw new Error("Arguments to thread should be defined");
        }
        args.should.deep.contain({
            metadata: {a: "b"}
        });
    });

    it("posts message", async function() {
        when(messages.create(anything(), anything())).thenResolve(message1);

        const lastId = await wrapper.postMessage(threadId, "M1");
        if (undefined === lastId) {
            throw new Error("Last ID should be defined");
        }

        lastId.should.be.equal(message1.id);

        verify(
            messages.create(
                strictEqual(threadId),
                deepEqual({
                    role: "user",
                    content: "M1"
                })
            )
        ).once();
    });

    it("runs AI", async function() {
        const run1: Run = imock();
        when(run1.id).thenReturn("r1");
        when(run1.status).thenReturn("queued");
        const run2: Run = imock();
        when(run2.id).thenReturn("r2");
        when(run2.status).thenReturn("completed");

        when(runs.create(anything(), anything())).thenResolve(instance(run1));
        when(runs.retrieve(anything(), anything())).thenResolve(instance(run2));

        await wrapper.run(threadId, assistantId, data, testDispatcher);

        verify(runs.create(strictEqual(threadId), deepEqual({assistant_id: assistantId}))).once();
        verify(runs.retrieve(strictEqual(threadId), strictEqual("r1"))).once();
    });

    it("runs tools", async function() {
        const toolCallId = "tc1";

        const run1: Run = imock();
        when(run1.id).thenReturn("r1");
        when(run1.status).thenReturn("queued");

        const run2: Run = imock();
        when(run2.id).thenReturn("r2");
        when(run2.required_action).thenReturn({
            type: "submit_tool_outputs",
            submit_tool_outputs: {
                tool_calls: [{
                    id: toolCallId,
                    type: "function",
                    function: {
                        arguments: JSON.stringify({a: 2, b: 2}),
                        name: "multiply"
                    }
                }]
            }
        });
        when(run2.status).thenReturn("requires_action");

        const run3: Run = imock();
        when(run3.id).thenReturn("r3");
        when(run3.status).thenReturn("completed");
        const iRun3 = instance(run3);

        when(runs.create(anything(), anything())).thenResolve(instance(run1));
        when(runs.retrieve(anything(), anything())).thenResolve(instance(run2)).thenResolve(iRun3);
        when(runs.submitToolOutputs(anything(), anything(), anything())).thenResolve(iRun3);

        const result = await wrapper.run(threadId, assistantId, data, testDispatcher);
        result.should.deep.equal({
            value: "dispatched"
        });

        verify(runs.create(strictEqual(threadId), deepEqual({assistant_id: assistantId}))).once();
        verify(runs.retrieve(strictEqual(threadId), strictEqual("r1"))).once();
        verify(runs.submitToolOutputs(
            strictEqual(threadId),
            strictEqual("r2"),
            deepEqual({
                tool_outputs: [
                    {
                        output: JSON.stringify({data: {value: "dispatched"}}),
                        tool_call_id: toolCallId
                    }
                ]
            })
        )).once();
        verify(runs.retrieve(strictEqual(threadId), strictEqual("r3"))).once();
    });

    it("runs tools and returns dispatch error", async function() {
        const errorMessage = "Some error";
        const errorDispatcher: ToolsDispatcher<Data> = () => Promise.reject(new Error(errorMessage));
        const toolCallId = "tc1";

        const run1: Run = imock();
        when(run1.id).thenReturn("r1");
        when(run1.status).thenReturn("queued");

        const run2: Run = imock();
        when(run2.id).thenReturn("r2");
        when(run2.required_action).thenReturn({
            type: "submit_tool_outputs",
            submit_tool_outputs: {
                tool_calls: [{
                    id: toolCallId,
                    type: "function",
                    function: {
                        arguments: JSON.stringify({a: 2, b: 2}),
                        name: "multiply"
                    }
                }]
            }
        });
        when(run2.status).thenReturn("requires_action");

        const run3: Run = imock();
        when(run3.id).thenReturn("r3");
        when(run3.status).thenReturn("completed");
        const iRun3 = instance(run3);

        when(runs.create(anything(), anything())).thenResolve(instance(run1));
        when(runs.retrieve(anything(), anything())).thenResolve(instance(run2)).thenResolve(iRun3);
        when(runs.submitToolOutputs(anything(), anything(), anything())).thenResolve(iRun3);

        const result = await wrapper.run(threadId, assistantId, data, errorDispatcher);
        result.should.deep.equal({
            value: "test"
        });

        verify(runs.submitToolOutputs(
            anything(),
            anything(),
            deepEqual({
                tool_outputs: [
                    {
                        output: JSON.stringify({error: errorMessage}),
                        tool_call_id: toolCallId
                    }
                ]
            })
        )).once();
    });

    it("runs tools and returns dispatch error when dispatcher throws", async function() {
        const errorMessage = "Some error";
        const errorDispatcher: ToolsDispatcher<Data> = () => {
            throw new Error(errorMessage);
        };

        const toolCallId = "tc1";

        const run1: Run = imock();
        when(run1.id).thenReturn("r1");
        when(run1.status).thenReturn("queued");

        const run2: Run = imock();
        when(run2.id).thenReturn("r2");
        when(run2.required_action).thenReturn({
            type: "submit_tool_outputs",
            submit_tool_outputs: {
                tool_calls: [{
                    id: toolCallId,
                    type: "function",
                    function: {
                        arguments: JSON.stringify({a: 2, b: 2}),
                        name: "multiply"
                    }
                }]
            }
        });
        when(run2.status).thenReturn("requires_action");

        const run3: Run = imock();
        when(run3.id).thenReturn("r3");
        when(run3.status).thenReturn("completed");
        const iRun3 = instance(run3);

        when(runs.create(anything(), anything())).thenResolve(instance(run1));
        when(runs.retrieve(anything(), anything())).thenResolve(instance(run2)).thenResolve(iRun3);
        when(runs.submitToolOutputs(anything(), anything(), anything())).thenResolve(iRun3);

        const result = await wrapper.run(threadId, assistantId, data, errorDispatcher);
        result.should.deep.equal({
            value: "test"
        });

        verify(runs.submitToolOutputs(
            anything(),
            anything(),
            deepEqual({
                tool_outputs: [
                    {
                        output: JSON.stringify({error: errorMessage}),
                        tool_call_id: toolCallId
                    }
                ]
            })
        )).once();
    });

    it("fails if AI fails", async function() {
        const run1: Run = imock();
        when(run1.id).thenReturn("r1");
        when(run1.status).thenReturn("queued");
        const run2: Run = imock();
        when(run2.id).thenReturn("r2");
        when(run2.status).thenReturn("failed");
        when(run2.last_error).thenReturn({code: "server_error", message: "Some error"});

        when(runs.create(anything(), anything())).thenResolve(instance(run1));
        when(runs.retrieve(anything(), anything())).thenResolve(instance(run2));

        return wrapper.run(threadId, assistantId, data, testDispatcher)
            .should
            .eventually
            .be
            .rejectedWith("Error running AI");
    });

    it("gets messages", async function() {
        const page: AbstractPage<ThreadMessage> = imock();
        when(page.getPaginatedItems()).thenReturn([
            message1,
            message2
        ]);

        const list: ThreadMessagesPage = imock();
        when(list.iterPages()).thenReturn((async function* () {
            yield instance(page);
        })());

        when(messages.list(anything(), anything())).thenResolve(instance(list));

        const result = await wrapper.getMessages(threadId, "m1");
        result.should.deep.equal({
            messages: [["m1", "Message 1"], ["m2", "Message 2"]],
            latestMessageId: "m2"
        });

        verify(messages.list(strictEqual(threadId), deepEqual({after: "m1", order: "asc"})));
    });

    it("closes thread", async function() {
        when(threads.del(anything())).thenResolve({
            id: threadId,
            deleted: true,
            object: "thread.deleted"
        });
        await wrapper.deleteThread(threadId);
        verify(threads.del(strictEqual(threadId)));
    });
});
