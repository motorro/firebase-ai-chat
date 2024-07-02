"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandBackWorker = exports.HandOverWorker = void 0;
const BaseChatWorker_1 = require("./BaseChatWorker");
const handOver_1 = require("../chat/handOver");
const HandOverCommand_1 = require("../data/HandOverCommand");
class HandOverWorker extends BaseChatWorker_1.BaseChatWorker {
    constructor(firestore, scheduler, cleaner, logData, schedulers) {
        super(firestore, scheduler, cleaner, logData);
        this.handOver = new handOver_1.HandOverDelegate(firestore, schedulers);
    }
    isSupportedCommand(req) {
        return (0, HandOverCommand_1.isHandOverCommand)(req.data);
    }
    async doDispatch(command, state, control) {
        const hoCommand = command;
        await control.safeUpdate(async (tx) => {
            await this.handOver.handOver(tx, command.commonData.chatDocumentPath, state, {
                config: hoCommand.config,
                messages: hoCommand.messages,
                chatMeta: hoCommand.chatMeta,
                workerMeta: hoCommand.commonData.meta
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
        return (0, HandOverCommand_1.isHandBackCommand)(req.data);
    }
    async doDispatch(command, state, control) {
        const hoCommand = command;
        await control.safeUpdate(async (tx) => {
            await this.handOver.handOver(tx, command.commonData.chatDocumentPath, state, {
                config: hoCommand.config,
                messages: hoCommand.messages,
                chatMeta: hoCommand.chatMeta,
                workerMeta: hoCommand.commonData.meta
            });
        });
    }
}
exports.HandBackWorker = HandBackWorker;
//# sourceMappingURL=HandOver.js.map