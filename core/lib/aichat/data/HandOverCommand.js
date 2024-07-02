"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandBackCommand = exports.isHandOverCommand = void 0;
const ChatCommand_1 = require("./ChatCommand");
/**
 * Checks if data is a HandOverCommand
 * @param data Data to check
 * @return True if data is HandOverCommand
 */
function isHandOverCommand(data) {
    return (0, ChatCommand_1.isChatCommand)(data) && "handOver" === data.actionData;
}
exports.isHandOverCommand = isHandOverCommand;
/**
 * Checks if data is a HandBackCommand
 * @param data Data to check
 * @return True if data is HandBackCommand
 */
function isHandBackCommand(data) {
    return (0, ChatCommand_1.isChatCommand)(data) && "handBack" === data.actionData;
}
exports.isHandBackCommand = isHandBackCommand;
//# sourceMappingURL=HandOverCommand.js.map