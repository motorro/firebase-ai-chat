import { AssistantConfig, CommandScheduler, NewMessage, TaskScheduler } from "@motorro/firebase-ai-chat-core";
import { ChatCommandData } from "@motorro/firebase-ai-chat-core/lib/aichat/data/ChatCommandQueue";
/**
 * Schedules OpenAI actions
 */
export declare class OpenAICommandScheduler implements CommandScheduler {
    private readonly queueName;
    private readonly scheduler;
    constructor(queueName: string, scheduler: TaskScheduler);
    isSupported(config: AssistantConfig): boolean;
    create(common: ChatCommandData): Promise<void>;
    createAndRun(common: ChatCommandData): Promise<void>;
    singleRun(common: ChatCommandData): Promise<void>;
    postAndRun(common: ChatCommandData): Promise<void>;
    handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void>;
    handBackCleanup(common: ChatCommandData, config: AssistantConfig): Promise<void>;
    close(common: ChatCommandData): Promise<void>;
    private schedule;
}
