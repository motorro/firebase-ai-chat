"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingWorker = void 0;
const BaseChatWorker_1 = require("./BaseChatWorker");
class SchedulingWorker extends BaseChatWorker_1.BaseChatWorker {
    isSupportedCommand(req) {
        throw new Error("Method not implemented.");
    }
    doDispatch(command, state, control) {
        throw new Error("Method not implemented.");
    }
}
exports.SchedulingWorker = SchedulingWorker;
//# sourceMappingURL=SchedulingWorker.js.map