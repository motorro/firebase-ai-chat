import {AssistantConfig, CommandScheduler, NewMessage, tagLogger, TaskScheduler} from "@motorro/firebase-ai-chat-core";
import {ChatCommandData} from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
import {VertexAiChatActions} from "./data/VertexAiChatAction";
import {DeliverySchedule} from "firebase-admin/lib/functions";
import {VertexAiChatCommand} from "./data/VertexAiChatCommand";
import {isVertexAiAssistantConfig} from "./data/VertexAiAssistantConfig";
import {engineId} from "../engineId";

const logger = tagLogger("VertexAICommandScheduler");

/**
 * Schedules OpenAI actions
 */
export class VertexAICommandScheduler implements CommandScheduler {
    private readonly queueName: string;
    private readonly scheduler: TaskScheduler;

    constructor(queueName: string, scheduler: TaskScheduler) {
        this.queueName = queueName;
        this.scheduler = scheduler;
    }

    isSupported(config: AssistantConfig): boolean {
        return isVertexAiAssistantConfig(config);
    }

    async create(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling create: ", JSON.stringify(common));
        await this.schedule(common, ["create", "switchToUserInput"]);
    }
    async createAndRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling createAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "switchToUserInput"]);
    }
    async singleRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling singleRun: ", JSON.stringify(common));
        await this.schedule(common, ["create", "post", "close"]);
    }
    async postAndRun(common: ChatCommandData): Promise<void> {
        logger.d("Scheduling postAndRun: ", JSON.stringify(common));
        await this.schedule(common, ["post", "switchToUserInput"]);
    }
    async handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void> {
        logger.d("Scheduling hand-over: ", JSON.stringify(common));
        await this.schedule(common, ["create", {name: "postExplicit", messages: handOverMessages}, "switchToUserInput"]);
    }

    private async schedule(common: ChatCommandData, actions: VertexAiChatActions, schedule?: DeliverySchedule): Promise<void> {
        const command: VertexAiChatCommand = {
            engine: engineId,
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
