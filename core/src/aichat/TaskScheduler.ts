import {DeliverySchedule} from "firebase-admin/functions";
import {BoundChatCommand, ChatAction, ChatCommand, isBoundChatCommand} from "./data/ChatCommand";

/**
 * Task queue scheduler
 */
export interface TaskScheduler<in Args extends Record<string, unknown> = Record<string, unknown>> {
    /**
     * Schedules tasks
     * @param queueName Dispatch queue name
     * @param command Command to dispatch
     * @param schedule Delivery schedule
     */
    schedule(queueName: string, command: Args, schedule?: DeliverySchedule): Promise<void>

    /**
     * Schedules tasks
     * @param queueName Dispatch queue name
     * @param command Commands to dispatch
     * @param schedule Delivery schedule
     */
    schedule(queueName: string, command: ReadonlyArray<Args>, schedule?: DeliverySchedule): Promise<void>

    /**
     * Retrieves queue maximum number of retries
     * @param queueName
     */
    getQueueMaxRetries(queueName: string): Promise<number>
}

/**
 * Schedules chat command to default queue or to the bound one
 * @param scheduler Task scheduler
 * @param queueName Default queue name
 * @param chatCommand Chat command to schedule
 */
export async function scheduleCommand(
    scheduler: TaskScheduler<ChatCommand<ChatAction>>,
    queueName: string,
    chatCommand: ChatCommand<ChatAction> | BoundChatCommand<ChatAction>
): Promise<void> {
    let command: ChatCommand<ChatAction>;
    let queue = queueName;
    if (isBoundChatCommand(chatCommand)) {
        command = chatCommand.command;
        queue = chatCommand.queueName;
    } else {
        command = <ChatCommand<ChatAction>>chatCommand;
    }
    await scheduler.schedule(queue, command);
}

