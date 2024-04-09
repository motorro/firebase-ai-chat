import { DeliverySchedule } from "firebase-admin/functions";
import { ChatCommandData } from "./data/ChatCommandData";
/**
 * Chat command type
 */
export interface ChatCommand<A> {
    readonly commonData: ChatCommandData;
    readonly actions: ReadonlyArray<A>;
}
/**
 * Task queue scheduler
 */
export interface TaskScheduler {
    /**
     * Schedules tasks
     * @param queueName Dispatch queue name
     * @param command Command to dispatch
     * @param schedule Delivery schedule
     */
    schedule(queueName: string, command: ChatCommand<unknown>, schedule?: DeliverySchedule): Promise<void>;
    /**
     * Retrieves queue maximum number of retries
     * @param queueName
     */
    getQueueMaxRetries(queueName: string): Promise<number>;
}
