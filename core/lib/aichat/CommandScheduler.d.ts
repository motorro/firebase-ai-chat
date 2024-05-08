import { ChatCommandData } from "./data/ChatCommandData";
/**
 * Schedules common chat commands
 */
export interface CommandScheduler {
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
    handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<string>): Promise<void>;
    /**
     * Returns chat to next popped assistant
     * @param common Common command data
     */
    handBack(common: ChatCommandData): Promise<void>;
    /**
     * Closes chat and cleans-up
     * @param common Common command data
     */
    close(common: ChatCommandData): Promise<void>;
}
