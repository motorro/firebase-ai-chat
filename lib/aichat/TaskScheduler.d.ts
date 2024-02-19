import { ChatCommand } from "./data/ChatCommand";
import { DeliverySchedule } from "firebase-admin/functions";
export interface TaskScheduler {
    schedule(name: string, command: ChatCommand, schedule: DeliverySchedule): Promise<void>;
}
