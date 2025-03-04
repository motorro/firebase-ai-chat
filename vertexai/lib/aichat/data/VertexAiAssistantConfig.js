"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isVertexAiAssistantConfig = isVertexAiAssistantConfig;
const engineId_1 = require("../../engineId");
function isVertexAiAssistantConfig(config) {
    return "object" === typeof config && null !== config
        && "engine" in config && engineId_1.engineId === config.engine
        && "instructionsId" in config;
}
//# sourceMappingURL=VertexAiAssistantConfig.js.map