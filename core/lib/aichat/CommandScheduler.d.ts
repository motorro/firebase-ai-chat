import { ChatCommandData } from "./data/ChatCommandData";
import { AssistantConfig } from "./data/ChatState";
import { NewMessage } from "./data/NewMessage";
/**
 * Schedules common chat commands
 */
export interface CommandScheduler {
    /**
     * Checks is passed config is supported by command scheduler
     * @param config Assistant config
     * @return True if config is supported
     */
    isSupported(config: AssistantConfig): boolean;
    /**
     * Creates chat
     * @param common Common command data
     */
    create(common: ChatCommandData): Promise<void>;
    /**
     * Creates chat and runs AI on current messages
     * @param common Common command data
     */
    createAndRun(common: ChatCommandData): Promise<void>;
    /**
     * Creates, runs and closes chat
     * @param common Common command data
     */
    singleRun(common: ChatCommandData): Promise<void>;
    /**
     * Posts new user message and runs AI
     * @param common Common command data
     */
    postAndRun(common: ChatCommandData): Promise<void>;
    /**
     * Hands over chat to another assistant
     * @param common Common command data
     * @param handOverMessages Messages used to hand-over chat
     */
    handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void>;
}
/**
 * Returns a scheduler to schedule a command
 * @param schedulers A list of supported schedulers
 * @param config Config that scheduler should support
 * @returns Appropriate scheduler or throws an error
 */
export declare function getScheduler(schedulers: ReadonlyArray<CommandScheduler>, config: AssistantConfig): CommandScheduler;
