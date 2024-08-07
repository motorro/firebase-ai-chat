import { AssistantConfig, CommandScheduler, NewMessage, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { ChatCommandData } from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
/**
 * Schedules OpenAI actions
 */
export declare class VertexAICommandScheduler implements CommandScheduler {
    private readonly queueName;
    private readonly scheduler;
    constructor(queueName: string, scheduler: TaskScheduler);
    isSupported(config: AssistantConfig): boolean;
    create(common: ChatCommandData): Promise<void>;
    createAndRun(common: ChatCommandData): Promise<void>;
    singleRun(common: ChatCommandData): Promise<void>;
    postAndRun(common: ChatCommandData): Promise<void>;
    handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void>;
    handBack(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void>;
    private schedule;
}
