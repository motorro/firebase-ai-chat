"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBoundChatCommand = void 0;
function isBoundChatCommand(data) {
    return "object" === typeof data && null !== data
        && "queueName" in data && "string" === typeof data.queueName
        && "command" in data && "object" === typeof data.command;
}
exports.isBoundChatCommand = isBoundChatCommand;
//# sourceMappingURL=ChatCommand.js.map