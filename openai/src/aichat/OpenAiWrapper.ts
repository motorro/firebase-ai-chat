import {AiWrapper, Messages} from "../../../core/src/aichat/AiWrapper";
import {DispatchError, DispatchResult, ToolsDispatcher} from "../../../core/src/aichat/ToolsDispatcher";
import OpenAI from "openai";
import {ThreadCreateParams} from "openai/src/resources/beta/threads/threads";
import {sleep} from "openai/core";
import {
    RequiredActionFunctionToolCall,
    RunSubmitToolOutputsParams,
    MessagesPage
} from "openai/resources/beta/threads";
import ToolOutput = RunSubmitToolOutputsParams.ToolOutput;
import {logger, ChatData, ChatError} from "@motorro/firebase-ai-chat-core";

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

    // eslint-disable-next-line max-len
    async run<DATA extends ChatData>(
        threadId: string,
        assistantId: string,
        dataSoFar: DATA,
        dispatcher: ToolsDispatcher<DATA>
    ): Promise<DATA> {
        logger.d("Running Assistant for:", threadId);
        return this.runAi(async (ai) => {
            let run = await ai.beta.threads.runs.create(threadId, {assistant_id: assistantId});
            let data = dataSoFar;
            let complete = false;

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
                                await runTools(requiredAction?.submit_tool_outputs?.tool_calls || []);
                                break;
                            default:
                                throw new ChatError("internal", true, `Unknown action: ${requiredActionType}`);
                        }
                        break;
                    default:
                        throw new ChatError("unimplemented", true, `Thread run error - unknown status. Status: ${status}`);
                }
            }

            return data;

            /**
             * Checks thread run status
             * @return True if thread is still running
             */
            function isRunning(): boolean {
                return ["queued", "in_progress", "cancelling"].indexOf(run.status) >= 0;
            }

            /**
             * Runs tools and updates the thread with result
             * @param toolCalls Tool call instructions
             */
            async function runTools(toolCalls: Array<RequiredActionFunctionToolCall>): Promise<void> {
                if (0 === toolCalls.length) {
                    return Promise.resolve();
                }

                const dispatches: Array<ToolOutput> = [];
                for (const toolCall of toolCalls) {
                    logger.d(`Running tool ${toolCall.function.name}. Thread:`, threadId);
                    logger.d("Data so far:", data);
                    logger.d("Arguments:", JSON.parse(toolCall.function.arguments));

                    let result: DispatchResult<DATA>;
                    try {
                        data = await dispatcher(data, toolCall.function.name, JSON.parse(toolCall.function.arguments));
                        result = {data: data};
                    } catch (e: unknown) {
                        logger.w("Error dispatching function:", e);
                        result = OpenAiWrapper.getDispatchError(e);
                    }

                    logger.d("Result:", result);
                    dispatches.push(
                        {
                            output: JSON.stringify(result),
                            tool_call_id: toolCall.id
                        }
                    );
                }

                run = await ai.beta.threads.runs.submitToolOutputs(threadId, run.id, {tool_outputs: dispatches});
            }
        });
    }

    private static getDispatchError(e: unknown): DispatchError {
        if ("string" === typeof e) {
            return {
                error: e
            };
        }
        if ("object" === typeof e && null !== e) {
            if ("error" in e && "string" === typeof e.error) {
                return {
                    error: e.error
                };
            }
            if ("message" in e && "string" === typeof e.message) {
                return {
                    error: e.message
                };
            }
            return {
                error: e.toString()
            };
        }
        return {
            error: "Unknown error"
        };
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
