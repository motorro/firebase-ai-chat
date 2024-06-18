import {ChatCommandData} from "./data/ChatCommandData";
import {AssistantConfig} from "./data/ChatState";
import {NewMessage} from "./data/NewMessage";

/**
 * Schedules common chat commands
 */
export interface CommandScheduler {
    /**
     * Checks is passed config is supported by command scheduler
     * @param config Assistant config
     * @return True if config is supported
     */
    isSupported(config: AssistantConfig): boolean

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
    handOver(common: ChatCommandData, handOverMessages: ReadonlyArray<NewMessage>): Promise<void>

    /**
     * Cleanup after chat hand-over
     * @param common Common command data
     * @param config Assistant config who has lost the chat
     */
    handBackCleanup(common: ChatCommandData, config: AssistantConfig): Promise<void>

    /**
     * Closes chat and cleans-up
     * @param common Common command data
     */
    close(common: ChatCommandData): Promise<void>;
}
