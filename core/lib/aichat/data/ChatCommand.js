"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isChatCommand = isChatCommand;
exports.isBoundChatCommand = isBoundChatCommand;
function isChatCommand(data) {
    return "object" === typeof data && null !== data
        && "commonData" in data && "object" === typeof data.commonData
        && "actionData" in data && "object" === typeof data.actionData;
}
function isBoundChatCommand(data) {
    return "object" === typeof data && null !== data
        && "queueName" in data && "string" === typeof data.queueName
        && "command" in data && "object" === typeof data.command;
}
//# sourceMappingURL=ChatCommand.js.map