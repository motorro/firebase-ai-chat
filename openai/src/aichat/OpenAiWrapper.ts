import {
    ChatData,
    ChatError,
    Continuation,
    isDispatchError,
    isDispatchSuccess,
    logger,
    Messages,
    ToolsContinuationDispatcher
} from "@motorro/firebase-ai-chat-core";
import OpenAI from "openai";
import {ThreadCreateParams} from "openai/src/resources/beta/threads/threads";
import {sleep} from "openai/core";
import {MessagesPage, RequiredActionFunctionToolCall, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import ToolOutput = RunSubmitToolOutputsParams.ToolOutput;
import {AiWrapper} from "./AiWrapper";
import {RunContinuationMeta, RunContinuationRequest} from "./data/RunResponse";

/**
 * Wraps Open AI assistant use
 */
export class OpenAiWrapper implements AiWrapper {
    private readonly openAi: OpenAI;

    constructor(openAi: OpenAI) {
        this.openAi = openAi;
    }

    async createThread(meta: Readonly<Record<string, string>>): Promise<string> {
        logger.d("Creating thread...", meta);
        const body: ThreadCreateParams = {
            metadata: meta
        };
        const thread = await this.runAi((ai) => ai.beta.threads.create(body));
        return thread.id;
    }

    async postMessage(threadId: string, message: string): Promise<string> {
        logger.d("Posting message...");
        return this.runAi(async (ai) => {
            const created = await ai.beta.threads.messages.create(
                threadId,
                {
                    role: "user",
                    content: message
                }
            );
            return created.id;
        });
    }

    async run<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>,
        meta: (runId: string) => RunContinuationMeta
    ): Promise<Continuation<DATA>> {
        return await this.doRun(
            threadId,
            assistantId,
            dataSoFar,
            dispatcher,
            meta
        )
    }

    private async doRun<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>,
        meta: (runId: string) => RunContinuationMeta,
        passedRun?: OpenAI.Beta.Threads.Runs.Run
    ): Promise<Continuation<DATA>> {
        logger.d("Running Assistant for:", threadId);
        return this.runAi(async (ai) => {
            let run = passedRun || await ai.beta.threads.runs.create(
                threadId,
                {assistant_id: assistantId}
            );
            let data = dataSoFar;
            let complete = false;

            const runTools = async (toolCalls: Array<RequiredActionFunctionToolCall>)=> {
                if (0 === toolCalls.length) {
                    return Continuation.resolve(data);
                }

                logger.d("Dispatching tools...");
                try {
                    const result = await dispatcher.dispatch(
                        data,
                        toolCalls.map((call) => ({
                            toolCallId: call.id,
                            toolName: call.function.name,
                            soFar: data,
                            args: JSON.parse(call.function.arguments)
                        })),
                        meta(run.id)
                    );
                    if (result.isResolved()) {
                        logger.d("All tools dispatched");
                        return await this.processToolsResponse(
                            threadId,
                            assistantId,
                            dataSoFar,
                            dispatcher,
                            meta,
                            {
                                runId: run.id,
                                toolsResult: result.value.responses
                            }
                        )
                    } else {
                        logger.d("Some tools suspended...")
                        return Continuation.suspend();
                    }
                } catch (e) {
                    logger.e("Tool dispatch failed:", e);
                    throw new ChatError("internal", true, "Error dispatching tool calls", e);
                }
            };

            const isRunning = () => {
                return ["queued", "in_progress", "cancelling"].indexOf(run.status) >= 0;
            }

            while (false === complete) {
                logger.d("Started assistant run: ", run.id);
                do {
                    await sleep(1000);
                    run = await this.runAi(async () =>
                        this.openAi.beta.threads.runs.retrieve(threadId, run.id)
                    );
                } while (isRunning());
                logger.d("Complete assistant run: ", run.id);

                const status = run.status;
                const requiredAction = run.required_action;
                const requiredActionType = requiredAction?.type;

                switch (status) {
                    case "completed":
                        logger.d("Running Assistant complete for:", threadId);
                        complete = true;
                        continue;
                    case "cancelled":
                        throw new ChatError("cancelled", true, `Thread run error. Status: cancelled, Error: ${run.last_error}`);
                    case "failed":
                        throw new ChatError("internal", true, `Thread run error. Status: failed, Error: ${run.last_error}`);
                    case "expired":
                        throw new ChatError("deadline-exceeded", true, `Thread run error. Status: expired, Error: ${run.last_error}`);
                    case "requires_action":
                        logger.d("Running Assistant actions for:", threadId);
                        switch (requiredActionType) {
                            case "submit_tool_outputs":
                                return runTools(requiredAction?.submit_tool_outputs?.tool_calls || []);
                            default:
                                throw new ChatError("internal", true, `Unknown action: ${requiredActionType}`);
                        }
                    default:
                        throw new ChatError("unimplemented", true, `Thread run error - unknown status. Status: ${status}`);
                }
            }

            return Continuation.resolve(data);
        });
    }

    async processToolsResponse<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatcher: ToolsContinuationDispatcher<DATA, RunContinuationMeta>,
        meta: (runId: string) => RunContinuationMeta,
        request: RunContinuationRequest<DATA>
    ): Promise<Continuation<DATA>> {
        logger.d(`Submitting tools result: ${threadId} / ${assistantId}`);
        const dispatches: Array<ToolOutput> = request.toolsResult.map((it) => ({
            output: JSON.stringify(it.response),
            tool_call_id: it.toolCallId
        }));

        let data: DATA = dataSoFar;
        for (const r of request.toolsResult) {
            const response = r.response;
            if (isDispatchSuccess(response)) {
                data = response.data;
            }
            if (isDispatchError(response)) {
                logger.d("Error in dispatch response:", response);
                break;
            }
        }

        return await this.doRun(
            threadId,
            assistantId,
            data,
            dispatcher,
            meta,
            await this.runAi((ai) => {
                return ai.beta.threads.runs.submitToolOutputs(threadId, request.runId, {tool_outputs: dispatches});
            })
        );
    }

    async getMessages(threadId: string, from: string | undefined): Promise<Messages> {
        logger.d("Getting messages from: ", threadId);
        return await this.runAi(async (ai) => {
            let cursor = from;
            const messages: Array<[string, string]> = [];

            const list: MessagesPage = await ai.beta.threads.messages.list(
                threadId,
                {after: cursor, order: "asc"}
            );

            for await (const page of list.iterPages()) {
                page.getPaginatedItems().forEach((message) => {
                    cursor = message.id;
                    message.content.forEach((content) => {
                        switch (content.type) {
                            case "text":
                                messages.push([message.id, content.text.value]);
                                break;
                            default:
                                throw new Error(`Unsupported message type: ${content.type}`);
                        }
                    });
                });
            }

            return {
                messages: messages,
                latestMessageId: cursor
            };
        });
    }

    async deleteThread(threadId: string): Promise<void> {
        logger.d("Deleting thread: ", threadId);
        await this.runAi((ai) => ai.beta.threads.del(threadId));
    }

    /**
     * Runs AI
     * @param block Function to run
     * @private
     */
    private async runAi<R>(block: (ai: OpenAI) => Promise<R>): Promise<R> {
        try {
            return await block(this.openAi);
        } catch (e) {
            logger.e("Open AI error", e);
            return Promise.reject(
                new ChatError("unavailable", false, "Error running AI", e)
            );
        }
    }
}
