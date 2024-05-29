"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchToUserWorker = void 0;
const VertexAiQueueWorker_1 = require("./VertexAiQueueWorker");
class SwitchToUserWorker extends VertexAiQueueWorker_1.VertexAiQueueWorker {
    static isSupportedAction(action) {
        return "switchToUserInput" === action;
    }
    async doDispatch(command, _state, control) {
        await this.continueQueue(control, command);
    }
}
exports.SwitchToUserWorker = SwitchToUserWorker;
//# sourceMappingURL=SwitchToUserWorker.js.map