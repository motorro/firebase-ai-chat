"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexAICommandScheduler = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
const VertexAiAssistantConfig_1 = require("./data/VertexAiAssistantConfig");
const engineId_1 = require("../engineId");
/**
 * Close command delay to settle down AI runs
 */
const SCHEDULE_CLOSE_AFTER = 3 * 60;
/**
 * Schedules OpenAI actions
 */
class VertexAICommandScheduler {
    constructor(queueName, scheduler) {
        this.queueName = queueName;
        this.scheduler = scheduler;
    }
    isSupported(config) {
        return (0, VertexAiAssistantConfig_1.isVertexAiAssistantConfig)(config);
    }
    async create(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling create: ", JSON.stringify(common));
        await this.schedule(common, ["create", "switchToUserInput"]);
    }
    async createAndRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling createAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "switchToUserInput"]);
    }
    async singleRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling singleRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "close"]);
    }
    async postAndRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling postAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["post", "switchToUserInput"]);
    }
    async handOver(common, handOverMessages) {
        firebase_ai_chat_core_1.logger.d("Scheduling hand-over: ", JSON.stringify(common));
        await this.schedule(common, ["create", { name: "postExplicit", messages: handOverMessages }, "switchToUserInput"]);
    }
    async handBackCleanup(common, config) {
        firebase_ai_chat_core_1.logger.d("Scheduling hand-back cleanup: ", JSON.stringify(common));
        await this.schedule(common, [{ name: "handBackCleanup", config: config }]);
    }
    async close(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling close: ", JSON.stringify(common));
        await this.schedule(common, ["close"], { scheduleDelaySeconds: SCHEDULE_CLOSE_AFTER });
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
exports.VertexAICommandScheduler = VertexAICommandScheduler;
//# sourceMappingURL=VertexAICommandScheduler.js.map