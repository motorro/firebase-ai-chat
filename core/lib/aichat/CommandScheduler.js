"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScheduler = getScheduler;
const ChatError_1 = require("./data/ChatError");
/**
 * Returns a scheduler to schedule a command
 * @param schedulers A list of supported schedulers
 * @param config Config that scheduler should support
 * @returns Appropriate scheduler or throws an error
 */
function getScheduler(schedulers, config) {
    const scheduler = schedulers.find((it) => it.isSupported(config));
    if (undefined === scheduler) {
        throw new ChatError_1.ChatError("unimplemented", true, "Chat configuration not supported");
    }
    return scheduler;
}
//# sourceMappingURL=CommandScheduler.js.map