import { ChatCommand } from "./data/ChatCommand";
import { DeliverySchedule } from "firebase-admin/functions";
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
    schedule(queueName: string, command: ChatCommand, schedule?: DeliverySchedule): Promise<void>;
    /**
     * Retrieves queue maximum number of retries
     * @param queueName
     */
    getQueueMaxRetries(queueName: string): Promise<number>;
}
