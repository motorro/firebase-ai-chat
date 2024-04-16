import { DeliverySchedule, Functions } from "firebase-admin/lib/functions";
import { TaskScheduler } from "./TaskScheduler";
export declare class FirebaseQueueTaskScheduler<Args extends Record<string, unknown> = Record<string, unknown>> implements TaskScheduler<Args> {
    private readonly auth;
    private readonly location;
    private readonly functions;
    constructor(functions: Functions, location: string);
    schedule(queueName: string, command: Args | ReadonlyArray<Args>, schedule?: DeliverySchedule): Promise<void>;
    getQueueMaxRetries(queueName: string): Promise<number>;
    private getFunctionUrl;
}
