"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleCommand = scheduleCommand;
const ChatCommand_1 = require("./data/ChatCommand");
/**
 * Schedules chat command to default queue or to the bound one
 * @param scheduler Task scheduler
 * @param queueName Default queue name
 * @param chatCommand Chat command to schedule
 */
async function scheduleCommand(scheduler, queueName, chatCommand) {
    let command;
    let queue = queueName;
    if ((0, ChatCommand_1.isBoundChatCommand)(chatCommand)) {
        command = chatCommand.command;
        queue = chatCommand.queueName;
    }
    else {
        command = chatCommand;
    }
    await scheduler.schedule(queue, command);
}
//# sourceMappingURL=TaskScheduler.js.map