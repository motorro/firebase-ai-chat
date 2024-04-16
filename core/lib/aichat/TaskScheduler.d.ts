import { DeliverySchedule } from "firebase-admin/functions";
/**
 * Task queue scheduler
 */
export interface TaskScheduler<Args extends Record<string, unknown> = Record<string, unknown>> {
    /**
     * Schedules tasks
     * @param queueName Dispatch queue name
     * @param command Command to dispatch
     * @param schedule Delivery schedule
     */
    schedule(queueName: string, command: Args, schedule?: DeliverySchedule): Promise<void>;
    /**
     * Schedules tasks
     * @param queueName Dispatch queue name
     * @param command Commands to dispatch
     * @param schedule Delivery schedule
     */
    schedule(queueName: string, command: ReadonlyArray<Args>, schedule?: DeliverySchedule): Promise<void>;
    /**
     * Retrieves queue maximum number of retries
     * @param queueName
     */
    getQueueMaxRetries(queueName: string): Promise<number>;
}
