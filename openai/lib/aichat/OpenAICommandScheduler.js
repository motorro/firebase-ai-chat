"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICommandScheduler = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const OpenAiAssistantConfig_1 = require("./data/OpenAiAssistantConfig");
const engineId_1 = require("../engineId");
/**
 * Close command delay to settle down AI runs
 */
const logger = (0, firebase_ai_chat_core_1.tagLogger)("OpenAICommandScheduler");
/**
 * Schedules OpenAI actions
 */
class OpenAICommandScheduler {
    constructor(queueName, scheduler) {
        this.queueName = queueName;
        this.scheduler = scheduler;
    }
    isSupported(config) {
        return (0, OpenAiAssistantConfig_1.isOpenAiAssistantConfig)(config);
    }
    async create(common) {
        logger.d("Scheduling create: ", JSON.stringify(common));
        await this.schedule(common, ["create", "switchToUserInput"]);
    }
    async createAndRun(common) {
        logger.d("Scheduling createAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "switchToUserInput"]);
    }
    async singleRun(common) {
        logger.d("Scheduling singleRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "close"]);
    }
    async postAndRun(common) {
        logger.d("Scheduling postAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["post", "run", "retrieve", "switchToUserInput"]);
    }
    async handOver(common, handOverMessages) {
        logger.d("Scheduling hand-over: ", JSON.stringify(common));
        await this.schedule(common, ["create", { name: "postExplicit", messages: handOverMessages }, "run", "retrieve", "switchToUserInput"]);
    }
    async handBack(common, handOverMessages) {
        logger.d("Scheduling hand-over: ", JSON.stringify(common));
        let actions = ["switchToUserInput"];
        if (0 !== handOverMessages.length) {
            actions = ["create", { name: "postExplicit", messages: handOverMessages }, "run", "retrieve", ...actions];
        }
        await this.schedule(common, actions);
    }
    async schedule(common, actions, schedule) {
        const command = {
            engine: engineId_1.engineId,
            commonData: common,
            actionData: actions
        };
        await this.scheduler.schedule(this.queueName, command, schedule);
    }
}
exports.OpenAICommandScheduler = OpenAICommandScheduler;
//# sourceMappingURL=OpenAICommandScheduler.js.map