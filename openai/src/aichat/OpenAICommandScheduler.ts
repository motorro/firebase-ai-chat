import {CommandScheduler, logger, TaskScheduler} from "@motorro/firebase-ai-chat-core";
import {ChatCommandData} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
import {OpenAiChatActions} from "./data/OpenAiChatAction";
import {DeliverySchedule} from "firebase-admin/lib/functions";
import {OpenAiChatCommand} from "./data/OpenAiChatCommand";

/**
 * Close command delay to settle down AI runs
 */
const SCHEDULE_CLOSE_AFTER = 3 * 60;

/**
 * Schedules OpenAI actions
 */
export class OpenAICommandScheduler implements CommandScheduler {
    private readonly queueName: string;
    private readonly scheduler: TaskScheduler;

    constructor(queueName: string, scheduler: TaskScheduler) {
        this.queueName = queueName;
        this.scheduler = scheduler;
    }

    async create(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling create: ", JSON.stringify(common));
        await this.schedule(common, ["create", "switchToUserInput"]);
    }
    async createAndRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling createAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "switchToUserInput"]);
    }
    async singleRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling singleRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "run", "retrieve", "close"]);
    }
    async postAndRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling postAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["post", "run", "retrieve", "switchToUserInput"]);
    }
    async close(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling close: ", JSON.stringify(common));
        await this.schedule(common, ["close"], {scheduleDelaySeconds: SCHEDULE_CLOSE_AFTER});
    }

    private async schedule(common: ChatCommandData, actions: OpenAiChatActions, schedule?: DeliverySchedule): Promise<void> {
        const command: OpenAiChatCommand = {
            engine: "openai",
            commonData: common,
            actionData: actions
        };
        await this.scheduler.schedule(
            this.queueName,
            command,
            schedule
        );
    }
}
