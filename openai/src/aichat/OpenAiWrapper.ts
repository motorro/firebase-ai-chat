import {
    ChatData,
    ChatError,
    Continuation,
    isDispatchError,
    isReducerSuccess,
    NewMessage,
    tagLogger,
    ToolCallRequest,
    ToolCallsResult
} from "@motorro/firebase-ai-chat-core";
import OpenAI from "openai";
import {ThreadCreateParams} from "openai/src/resources/beta/threads/threads";
import {sleep} from "openai/core";
import {MessagesPage, RequiredActionFunctionToolCall, RunSubmitToolOutputsParams} from "openai/resources/beta/threads";
import {AiWrapper} from "./AiWrapper";
import {RunContinuationRequest} from "./data/RunResponse";
import ToolOutput = RunSubmitToolOutputsParams.ToolOutput;
import {DefaultOpenAiMessageMapper, OpenAiMessageMapper} from "./OpenAiMessageMapper";
import {AiMessages} from "./data/AiMessages";

const logger = tagLogger("OpenAiWrapper");


/**
 * Wraps Open AI assistant use
 */
export class OpenAiWrapper implements AiWrapper {
    private readonly openAi: OpenAI;
    private readonly debugAi: boolean;
    private readonly messageMapper: OpenAiMessageMapper;

    constructor(openAi: OpenAI, debugAi = false, messageMapper: OpenAiMessageMapper = DefaultOpenAiMessageMapper) {
        this.openAi = openAi;
        this.debugAi = debugAi;
        this.messageMapper = messageMapper;
    }

    async createThread(meta: Readonly<Record<string, string>>): Promise<string> {
        logger.d("Creating thread...", meta);
        const body: ThreadCreateParams = {
            metadata: meta
        };
        const thread = await this.runAi((ai) => ai.beta.threads.create(body));
        return thread.id;
    }

    async postMessage(threadId: string, message: NewMessage): Promise<string> {
        logger.d("Posting message...");
        if (this.debugAi) {
            tagLogger("AI").d("About to send message to AI. Message:", JSON.stringify(message));
        }
        return this.runAi(async (ai) => {
            const created = await ai.beta.threads.messages.create(
                threadId,
                {
                    role: "user",
                    ...this.messageMapper.toAi(message)
                }
            );
            return created.id;
        });
    }

    async run<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, runId: string) => Promise<Continuation<ToolCallsResult<DATA>>>,
    ): Promise<Continuation<DATA>> {
        return await this.doRun(
            threadId,
            assistantId,
            dataSoFar,
            dispatch
        );
    }

    private async doRun<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, runId: string) => Promise<Continuation<ToolCallsResult<DATA>>>,
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

            const runTools = async (toolCalls: Array<RequiredActionFunctionToolCall>): Promise<Continuation<DATA>> => {
                if (0 === toolCalls.length) {
                    return Continuation.resolve(data);
                }

                logger.d("Dispatching tools...");

                if (this.debugAi) {
                    tagLogger("AI").d("Required tools to run:", JSON.stringify(toolCalls));
                }

                const result: Continuation<ToolCallsResult<DATA>> = await dispatch(
                    data,
                    toolCalls.map((call) => ({
                        toolCallId: call.id,
                        toolName: call.function.name,
                        soFar: data,
                        args: JSON.parse(call.function.arguments)
                    })),
                    run.id
                );
                if (result.isResolved()) {
                    logger.d("All tools dispatched");
                    data = result.value.data;
                    return this.processToolsResponse(
                        threadId,
                        assistantId,
                        data,
                        dispatch,
                        {
                            runId: run.id,
                            toolsResult: result.value.responses
                        }
                    );
                } else {
                    logger.d("Some tools suspended...");
                    return Continuation.suspend();
                }
            };

            const isRunning = (): boolean => {
                return ["queued", "in_progress", "cancelling"].indexOf(run.status) >= 0;
            };

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
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>, runId: string) => Promise<Continuation<ToolCallsResult<DATA>>>,
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
            if (isReducerSuccess(response)) {
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
            dispatch,
            await this.runAi((ai) => {
                if (this.debugAi) {
                    tagLogger("AI").d("Submitting tools output:", JSON.stringify(dispatches));
                }
                return ai.beta.threads.runs.submitToolOutputs(threadId, request.runId, {tool_outputs: dispatches});
            })
        );
    }

    async getMessages(threadId: string, from: string | undefined): Promise<AiMessages> {
        logger.d("Getting messages from: ", threadId);
        return await this.runAi(async (ai) => {
            let cursor = from;
            const messages: Array<[string, NewMessage]> = [];

            const list: MessagesPage = await ai.beta.threads.messages.list(
                threadId,
                {after: cursor, order: "asc"}
            );

            for await (const page of list.iterPages()) {
                page.getPaginatedItems().forEach((message) => {
                    cursor = message.id;
                    const mappedMessage = this.messageMapper.fromAi(message);
                    if (mappedMessage) {
                        messages.push([message.id, mappedMessage]);
                    }
                });
            }

            if (this.debugAi) {
                tagLogger("AI").d("Got messages from AI. Messages:", JSON.stringify(messages));
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
