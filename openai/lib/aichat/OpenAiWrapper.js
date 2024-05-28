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
    async run(threadId, assistantId, dataSoFar, dispatch) {
        return await this.doRun(threadId, assistantId, dataSoFar, dispatch);
    }
    async doRun(threadId, assistantId, dataSoFar, dispatch, passedRun) {
        firebase_ai_chat_core_1.logger.d("Running Assistant for:", threadId);
        return this.runAi(async (ai) => {
            var _a;
            let run = passedRun || await ai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
            let data = dataSoFar;
            let complete = false;
            const runTools = async (toolCalls) => {
                if (0 === toolCalls.length) {
                    return firebase_ai_chat_core_1.Continuation.resolve(data);
                }
                firebase_ai_chat_core_1.logger.d("Dispatching tools...");
                const result = await dispatch(data, toolCalls.map((call) => ({
                    toolCallId: call.id,
                    toolName: call.function.name,
                    soFar: data,
                    args: JSON.parse(call.function.arguments)
                })), run.id);
                if (result.isResolved()) {
                    firebase_ai_chat_core_1.logger.d("All tools dispatched");
                    data = result.value.data;
                    return this.processToolsResponse(threadId, assistantId, data, dispatch, {
                        runId: run.id,
                        toolsResult: result.value.responses
                    });
                }
                else {
                    firebase_ai_chat_core_1.logger.d("Some tools suspended...");
                    return firebase_ai_chat_core_1.Continuation.suspend();
                }
            };
            const isRunning = () => {
                return ["queued", "in_progress", "cancelling"].indexOf(run.status) >= 0;
            };
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
                                return runTools(((_a = requiredAction === null || requiredAction === void 0 ? void 0 : requiredAction.submit_tool_outputs) === null || _a === void 0 ? void 0 : _a.tool_calls) || []);
                            default:
                                throw new firebase_ai_chat_core_1.ChatError("internal", true, `Unknown action: ${requiredActionType}`);
                        }
                    default:
                        throw new firebase_ai_chat_core_1.ChatError("unimplemented", true, `Thread run error - unknown status. Status: ${status}`);
                }
            }
            return firebase_ai_chat_core_1.Continuation.resolve(data);
        });
    }
    async processToolsResponse(threadId, assistantId, dataSoFar, dispatch, request) {
        firebase_ai_chat_core_1.logger.d(`Submitting tools result: ${threadId} / ${assistantId}`);
        const dispatches = request.toolsResult.map((it) => ({
            output: JSON.stringify(it.response),
            tool_call_id: it.toolCallId
        }));
        let data = dataSoFar;
        for (const r of request.toolsResult) {
            const response = r.response;
            if ((0, firebase_ai_chat_core_1.isReducerSuccess)(response)) {
                data = response.data;
            }
            if ((0, firebase_ai_chat_core_1.isDispatchError)(response)) {
                firebase_ai_chat_core_1.logger.d("Error in dispatch response:", response);
                break;
            }
        }
        return await this.doRun(threadId, assistantId, data, dispatch, await this.runAi((ai) => {
            return ai.beta.threads.runs.submitToolOutputs(threadId, request.runId, { tool_outputs: dispatches });
        }));
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
//# sourceMappingURL=OpenAiWrapper.js.map