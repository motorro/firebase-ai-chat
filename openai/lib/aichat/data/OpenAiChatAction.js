"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCleanupAction = exports.isPostExplicitAction = void 0;
const OpenAiAssistantConfig_1 = require("./OpenAiAssistantConfig");
function isPostExplicitAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}
exports.isPostExplicitAction = isPostExplicitAction;
function isCleanupAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "cleanup" === data.name
        && "config" in data && (0, OpenAiAssistantConfig_1.isOpenAiAssistantConfig)(data.config);
}
exports.isCleanupAction = isCleanupAction;
//# sourceMappingURL=OpenAiChatAction.js.map