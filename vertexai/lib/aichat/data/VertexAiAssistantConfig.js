"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVertexAiAssistantConfig = void 0;
function isVertexAiAssistantConfig(config) {
    return "object" === typeof config && null !== config
        && "engine" in config && "vertexai" === config.engine
        && "instructionsId" in config;
}
exports.isVertexAiAssistantConfig = isVertexAiAssistantConfig;
//# sourceMappingURL=VertexAiAssistantConfig.js.map