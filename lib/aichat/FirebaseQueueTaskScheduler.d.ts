import { DeliverySchedule, Functions } from "firebase-admin/lib/functions";
import { ChatCommand } from "./data/ChatCommand";
import { TaskScheduler } from "./TaskScheduler";
export declare class FirebaseQueueTaskScheduler implements TaskScheduler {
    private readonly auth;
    private readonly location;
    private readonly functions;
    constructor(functions: Functions, location: string);
    schedule(queueName: string, command: ChatCommand, schedule?: DeliverySchedule): Promise<void>;
    getQueueMaxRetries(queueName: string): Promise<number>;
    private getFunctionUrl;
}
