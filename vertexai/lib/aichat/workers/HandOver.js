"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandBackWorker = exports.HandOverWorker = void 0;
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
const firebase_ai_chat_core_1 = require("@motorro/firebase-ai-chat-core");
class HandOverWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    constructor(firestore, scheduler, wrapper, cleaner, logData, schedulers) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.handOver = new firebase_ai_chat_core_1.HandOverDelegate(firestore, schedulers);
    }
    static isSupportedAction(action) {
        return (0, firebase_ai_chat_core_1.isHandOverAction)(action);
    }
    async doDispatch(command, state, control) {
        const hoAction = (command.actionData[0]);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handOver(tx, command.commonData.chatDocumentPath, state, {
                config: hoAction.config,
                messages: hoAction.messages,
                chatMeta: hoAction.chatMeta,
                workerMeta: command.commonData.meta
            });
        });
    }
}
exports.HandOverWorker = HandOverWorker;
class HandBackWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    constructor(firestore, scheduler, wrapper, cleaner, logData, schedulers) {
        super(firestore, scheduler, wrapper, cleaner, logData);
        this.handOver = new firebase_ai_chat_core_1.HandOverDelegate(firestore, schedulers);
    }
    static isSupportedAction(action) {
        return (0, firebase_ai_chat_core_1.isHandBackAction)(action);
    }
    async doDispatch(command, state, control) {
        const hoAction = (command.actionData[0]);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handBack(tx, command.commonData.chatDocumentPath, state, hoAction.messages, command.commonData.meta);
        });
    }
}
exports.HandBackWorker = HandBackWorker;
//# sourceMappingURL=HandOver.js.map