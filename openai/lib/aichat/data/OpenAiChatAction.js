"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandBackCleanupAction = exports.isPostExplicitAction = void 0;
const OpenAiAssistantConfig_1 = require("./OpenAiAssistantConfig");
function isPostExplicitAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}
exports.isPostExplicitAction = isPostExplicitAction;
function isHandBackCleanupAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "handBackCleanup" === data.name
        && "config" in data && (0, OpenAiAssistantConfig_1.isOpenAiAssistantConfig)(data.config);
}
exports.isHandBackCleanupAction = isHandBackCleanupAction;
//# sourceMappingURL=OpenAiChatAction.js.map