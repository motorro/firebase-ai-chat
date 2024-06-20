"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCleanupAction = exports.isPostExplicitAction = void 0;
const VertexAiAssistantConfig_1 = require("./VertexAiAssistantConfig");
function isPostExplicitAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "postExplicit" === data.name
        && "messages" in data && Array.isArray(data.messages);
}
exports.isPostExplicitAction = isPostExplicitAction;
function isCleanupAction(data) {
    return "object" === typeof data && null !== data
        && "name" in data && "cleanup" === data.name
        && "config" in data && (0, VertexAiAssistantConfig_1.isVertexAiAssistantConfig)(data.config);
}
exports.isCleanupAction = isCleanupAction;
//# sourceMappingURL=VertexAiChatAction.js.map