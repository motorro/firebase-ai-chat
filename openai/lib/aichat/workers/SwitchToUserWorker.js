"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchToUserWorker = void 0;
const BaseOpenAiWorker_1 = require("./BaseOpenAiWorker");
class SwitchToUserWorker extends BaseOpenAiWorker_1.BaseOpenAiWorker {
    isSupportedAction(action) {
        return "switchToUserInput" === action;
    }
    async doDispatch(actions, _data, _state, control) {
        await this.continueQueue(control, actions);
    }
}
exports.SwitchToUserWorker = SwitchToUserWorker;
//# sourceMappingURL=SwitchToUserWorker.js.map