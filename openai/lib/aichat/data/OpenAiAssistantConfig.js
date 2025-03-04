"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOpenAiAssistantConfig = isOpenAiAssistantConfig;
const engineId_1 = require("../../engineId");
function isOpenAiAssistantConfig(config) {
    return "object" === typeof config && null !== config
        && "engine" in config && engineId_1.engineId === config.engine
        && "assistantId" in config && "dispatcherId" in config;
}
//# sourceMappingURL=OpenAiAssistantConfig.js.map