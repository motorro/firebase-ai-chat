import { DeliverySchedule, Functions } from "firebase-admin/functions";
import { TaskScheduler } from "./TaskScheduler";
export declare class FirebaseQueueTaskScheduler<Args extends Record<string, unknown> = Record<string, unknown>> implements TaskScheduler<Args> {
    private readonly auth;
    private readonly region;
    private readonly functions;
    private readonly defaultSchedule;
    /**
     * Constructor
     * @param functions Functions instance
     * @param region Service region
     * @param defaultSchedule Default scheduling region to merge with those passed to schedule method
     */
    constructor(functions: Functions, region: string, defaultSchedule?: DeliverySchedule);
    schedule(queueName: string, command: Args | ReadonlyArray<Args>, schedule?: DeliverySchedule): Promise<void>;
    getQueueMaxRetries(queueName: string): Promise<number>;
    private getFunctionUrl;
}
