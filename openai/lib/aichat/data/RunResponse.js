"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRunContinuationMeta = void 0;
const engineId_1 = require("../../engineId");
function isRunContinuationMeta(meta) {
    return "object" === typeof meta && null !== meta
        && "engine" in meta && engineId_1.engineId === meta.engine
        && "runId" in meta && "string" === meta.runId;
}
exports.isRunContinuationMeta = isRunContinuationMeta;
//# sourceMappingURL=RunResponse.js.map