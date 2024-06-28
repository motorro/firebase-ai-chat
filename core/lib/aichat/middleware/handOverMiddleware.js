"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handOverMiddleware = void 0;
const handOver_1 = require("../chat/handOver");
function handOverMiddleware(db, schedulers, process) {
    const handOver = new handOver_1.HandOverDelegate(db, schedulers);
    return async (messages, chatDocumentPath, chatState, control) => {
        const hoControl = {
            safeUpdate: control.safeUpdate,
            next: control.next,
            handOver: async (data) => {
                return await db.runTransaction(async (tx) => {
                    return handOver.handOver(tx, chatDocumentPath, chatState, data);
                });
            },
            handBack: async (messages, workerMeta) => {
                return await db.runTransaction(async (tx) => {
                    return handOver.handBack(tx, chatDocumentPath, chatState, messages, workerMeta);
                });
            }
        };
        return process(messages, chatDocumentPath, chatState, hoControl);
    };
}
exports.handOverMiddleware = handOverMiddleware;
//# sourceMappingURL=handOverMiddleware.js.map