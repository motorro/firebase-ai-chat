"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBoundChatCommand = exports.isChatCommand = void 0;
function isChatCommand(data) {
    return "object" === typeof data && null !== data
        && "commonData" in data && "object" === typeof data.commonData
        && "actionData" in data && "object" === typeof data.actionData;
}
exports.isChatCommand = isChatCommand;
function isBoundChatCommand(data) {
    return "object" === typeof data && null !== data
        && "queueName" in data && "string" === typeof data.queueName
        && "command" in data && "object" === typeof data.command;
}
exports.isBoundChatCommand = isBoundChatCommand;
//# sourceMappingURL=ChatCommand.js.map