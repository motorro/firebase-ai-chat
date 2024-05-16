"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandBackCleanupAction = exports.isPostExplicitAction = void 0;
const VertexAiAssistantConfig_1 = require("./VertexAiAssistantConfig");
function isPostExplicitAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}
exports.isPostExplicitAction = isPostExplicitAction;
function isHandBackCleanupAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "handBackCleanup" === data.name
        && "config" in data && (0, VertexAiAssistantConfig_1.isVertexAiAssistantConfig)(data.config);
}
exports.isHandBackCleanupAction = isHandBackCleanupAction;
//# sourceMappingURL=VertexAiChatAction.js.map