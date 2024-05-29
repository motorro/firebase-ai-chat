"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchToUserWorker = void 0;
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class SwitchToUserWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    static isSupportedAction(action) {
        return "switchToUserInput" === action;
    }
    async doDispatch(command, _state, control) {
        await this.continueQueue(control, command);
    }
}
exports.SwitchToUserWorker = SwitchToUserWorker;
//# sourceMappingURL=SwitchToUserWorker.js.map