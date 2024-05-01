"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAICommandScheduler = void 0;
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
/**
 * Close command delay to settle down AI runs
 */
const SCHEDULE_CLOSE_AFTER = 3 * 60;
/**
 * Schedules OpenAI actions
 */
class OpenAICommandScheduler {
    constructor(queueName, scheduler) {
        this.queueName = queueName;
        this.scheduler = scheduler;
    }
    async create(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling create: ", JSON.stringify(common));
        await this.schedule(common, ["create", "switchToUserInput"]);
    }
    async createAndRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling createAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "switchToUserInput"]);
    }
    async singleRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling singleRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "close"]);
    }
    async postAndRun(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling postAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["post", "run", "retrieve", "switchToUserInput"]);
    }
    async close(common) {
        firebase_ai_chat_core_1.logger.d("Scheduling close: ", JSON.stringify(common));
        await this.schedule(common, ["close"], { scheduleDelaySeconds: SCHEDULE_CLOSE_AFTER });
    }
    async schedule(common, actions, schedule) {
        const command = {
            engine: "openai",
            commonData: common,
            actionData: actions
        };
        await this.scheduler.schedule(this.queueName, command, schedule);
    }
}
exports.OpenAICommandScheduler = OpenAICommandScheduler;
//# sourceMappingURL=OpenAICommandScheduler.js.map