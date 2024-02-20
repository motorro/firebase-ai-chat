import {AiWrapper, Messages} from "./AiWrapper";
import {ToolsDispatcher} from "./ToolsDispatcher";
import OpenAI from "openai";
import {ThreadCreateParams} from "openai/src/resources/beta/threads/threads";
import {sleep} from "openai/core";
import {
    RequiredActionFunctionToolCall,
    RunSubmitToolOutputsParams,
    ThreadMessagesPage
} from "openai/resources/beta/threads";
import ToolOutput = RunSubmitToolOutputsParams.ToolOutput;
import {logger} from "../logging";
import {HttpsError} from "firebase-functions/v2/https";
import {ChatData} from "./data/ChatState";


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

    async postMessages(threadId: string, messages: readonly string[]): Promise<string | undefined> {
        logger.d("Posting messages...", messages.length);
        return this.runAi(async (ai) => {
            let latestMessageId: string | undefined = undefined;
            for (const message of messages) {
                const created = await ai.beta.threads.messages.create(
                    threadId,
                    {
                        role: "user",
                        content: message
                    }
                );
                latestMessageId = created.id;
            }
            return latestMessageId;
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
                    case "failed":
                    case "expired":
                        throw new Error(`Thread run error. Status: ${run.status}, Error: ${run.last_error}`);
                    case "requires_action":
                        logger.d("Running Assistant actions for:", threadId);
                        switch (requiredActionType) {
                            case "submit_tool_outputs":
                                await runTools(requiredAction?.submit_tool_outputs?.tool_calls || []);
                                break;
                            default:
                                throw new Error(`Unknown action: ${requiredActionType}`);
                        }
                        break;
                    default:
                        throw new Error(`Unexpected run status: ${run.status}`);
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

                    data = await dispatcher(data, toolCall.function.name, JSON.parse(toolCall.function.arguments));

                    logger.d("Result:", data);
                    dispatches.push(
                        {
                            output: JSON.stringify(data),
                            tool_call_id: toolCall.id
                        }
                    );
                }

                run = await ai.beta.threads.runs.submitToolOutputs(threadId, run.id, {tool_outputs: dispatches});
            }
        });
    }

    async getMessages(threadId: string, from: string | undefined): Promise<Messages> {
        logger.d("Getting messages from: ", threadId);
        return await this.runAi(async (ai) => {
            let cursor = from;
            const messages: Array<string> = [];

            const list: ThreadMessagesPage = await ai.beta.threads.messages.list(
                threadId,
                {after: cursor, order: "asc"}
            );

            for await (const page of list.iterPages()) {
                page.getPaginatedItems().forEach((message) => {
                    cursor = message.id;
                    message.content.forEach((content) => {
                        switch (content.type) {
                            case "text":
                                messages.push(content.text.value);
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
                new HttpsError("unavailable", "Error running AI")
            );
        }
    }
}