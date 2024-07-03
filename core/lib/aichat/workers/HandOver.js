"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandBackWorker = exports.HandOverWorker = void 0;
const BaseChatWorker_1 = require("./BaseChatWorker");
const handOver_1 = require("../chat/handOver");
const HandOverAction_1 = require("../data/HandOverAction");
class HandOverWorker extends BaseChatWorker_1.BaseChatWorker {
    constructor(firestore, scheduler, cleaner, logData, schedulers) {
        super(firestore, scheduler, cleaner, logData);
        this.handOver = new handOver_1.HandOverDelegate(firestore, schedulers);
    }
    isSupportedCommand(req) {
        return (0, HandOverAction_1.isHandOverAction)(req.data.actionData);
    }
    async doDispatch(command, state, control) {
        const hoAction = (command.actionData);
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
class HandBackWorker extends BaseChatWorker_1.BaseChatWorker {
    constructor(firestore, scheduler, cleaner, logData, schedulers) {
        super(firestore, scheduler, cleaner, logData);
        this.handOver = new handOver_1.HandOverDelegate(firestore, schedulers);
    }
    isSupportedCommand(req) {
        return (0, HandOverAction_1.isHandBackAction)(req.data.actionData);
    }
    async doDispatch(command, state, control) {
        const hbAction = (command.actionData);
        await control.safeUpdate(async (tx) => {
            await this.handOver.handOver(tx, command.commonData.chatDocumentPath, state, {
                config: hbAction.config,
                messages: hbAction.messages,
                chatMeta: hbAction.chatMeta,
                workerMeta: command.commonData.meta
            });
        });
    }
}
exports.HandBackWorker = HandBackWorker;
//# sourceMappingURL=HandOver.js.map