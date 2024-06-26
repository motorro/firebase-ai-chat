"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiWrapper = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const core_1 = require("openai/core");
/**
 * Wraps Open AI assistant use
 */
class OpenAiWrapper {
    constructor(openAi) {
        this.openAi = openAi;
    }
    async createThread(meta) {
        firebase_ai_chat_core_1.logger.d("Creating thread...", meta);
        const body = {
            metadata: meta
        };
        const thread = await this.runAi((ai) => ai.beta.threads.create(body));
        return thread.id;
    }
    async postMessage(threadId, message) {
        firebase_ai_chat_core_1.logger.d("Posting message...");
        return this.runAi(async (ai) => {
            const created = await ai.beta.threads.messages.create(threadId, {
                role: "user",
                content: message
            });
            return created.id;
        });
    }
    // eslint-disable-next-line max-len
    async run(threadId, assistantId, dataSoFar, dispatcher) {
        firebase_ai_chat_core_1.logger.d("Running Assistant for:", threadId);
        return this.runAi(async (ai) => {
            var _a;
            let run = await ai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
            let data = dataSoFar;
            let complete = false;
            while (false === complete) {
                firebase_ai_chat_core_1.logger.d("Started assistant run: ", run.id);
                do {
                    await (0, core_1.sleep)(1000);
                    run = await this.runAi(async () => this.openAi.beta.threads.runs.retrieve(threadId, run.id));
                } while (isRunning());
                firebase_ai_chat_core_1.logger.d("Complete assistant run: ", run.id);
                const status = run.status;
                const requiredAction = run.required_action;
                const requiredActionType = requiredAction === null || requiredAction === void 0 ? void 0 : requiredAction.type;
                switch (status) {
                    case "completed":
                        firebase_ai_chat_core_1.logger.d("Running Assistant complete for:", threadId);
                        complete = true;
                        continue;
                    case "cancelled":
                        throw new firebase_ai_chat_core_1.ChatError("cancelled", true, `Thread run error. Status: cancelled, Error: ${run.last_error}`);
                    case "failed":
                        throw new firebase_ai_chat_core_1.ChatError("internal", true, `Thread run error. Status: failed, Error: ${run.last_error}`);
                    case "expired":
                        throw new firebase_ai_chat_core_1.ChatError("deadline-exceeded", true, `Thread run error. Status: expired, Error: ${run.last_error}`);
                    case "requires_action":
                        firebase_ai_chat_core_1.logger.d("Running Assistant actions for:", threadId);
                        switch (requiredActionType) {
                            case "submit_tool_outputs":
                                await runTools(((_a = requiredAction === null || requiredAction === void 0 ? void 0 : requiredAction.submit_tool_outputs) === null || _a === void 0 ? void 0 : _a.tool_calls) || []);
                                break;
                            default:
                                throw new firebase_ai_chat_core_1.ChatError("internal", true, `Unknown action: ${requiredActionType}`);
                        }
                        break;
                    default:
                        throw new firebase_ai_chat_core_1.ChatError("unimplemented", true, `Thread run error - unknown status. Status: ${status}`);
                }
            }
            return data;
            /**
             * Checks thread run status
             * @return True if thread is still running
             */
            function isRunning() {
                return ["queued", "in_progress", "cancelling"].indexOf(run.status) >= 0;
            }
            /**
             * Runs tools and updates the thread with result
             * @param toolCalls Tool call instructions
             */
            async function runTools(toolCalls) {
                if (0 === toolCalls.length) {
                    return Promise.resolve();
                }
                const dispatches = [];
                for (const toolCall of toolCalls) {
                    firebase_ai_chat_core_1.logger.d(`Running tool ${toolCall.function.name}. Thread:`, threadId);
                    firebase_ai_chat_core_1.logger.d("Data so far:", data);
                    firebase_ai_chat_core_1.logger.d("Arguments:", JSON.parse(toolCall.function.arguments));
                    let result;
                    try {
                        data = await dispatcher(data, toolCall.function.name, JSON.parse(toolCall.function.arguments));
                        result = { data: data };
                    }
                    catch (e) {
                        firebase_ai_chat_core_1.logger.w("Error dispatching function:", e);
                        result = OpenAiWrapper.getDispatchError(e);
                    }
                    firebase_ai_chat_core_1.logger.d("Result:", result);
                    dispatches.push({
                        output: JSON.stringify(result),
                        tool_call_id: toolCall.id
                    });
                }
                run = await ai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: dispatches });
            }
        });
    }
    static getDispatchError(e) {
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
    async getMessages(threadId, from) {
        firebase_ai_chat_core_1.logger.d("Getting messages from: ", threadId);
        return await this.runAi(async (ai) => {
            var _a, e_1, _b, _c;
            let cursor = from;
            const messages = [];
            const list = await ai.beta.threads.messages.list(threadId, { after: cursor, order: "asc" });
            try {
                for (var _d = true, _e = __asyncValues(list.iterPages()), _f; _f = await _e.next(), _a = _f.done, !_a;) {
                    _c = _f.value;
                    _d = false;
                    try {
                        const page = _c;
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
                    finally {
                        _d = true;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) await _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return {
                messages: messages,
                latestMessageId: cursor
            };
        });
    }
    async deleteThread(threadId) {
        firebase_ai_chat_core_1.logger.d("Deleting thread: ", threadId);
        await this.runAi((ai) => ai.beta.threads.del(threadId));
    }
    /**
     * Runs AI
     * @param block Function to run
     * @private
     */
    async runAi(block) {
        try {
            return await block(this.openAi);
        }
        catch (e) {
            firebase_ai_chat_core_1.logger.e("Open AI error", e);
            return Promise.reject(new firebase_ai_chat_core_1.ChatError("unavailable", false, "Error running AI", e));
        }
    }
}
exports.OpenAiWrapper = OpenAiWrapper;
//# sourceMappingURL=VertexAiWrapper.js.map