"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchToUserWorker = void 0;
const BaseVertexAiWorker_1 = require("./BaseVertexAiWorker");
class SwitchToUserWorker extends BaseVertexAiWorker_1.BaseVertexAiWorker {
    isSupportedAction(action) {
        return "switchToUserInput" === action;
    }
    async doDispatch(actions, _data, _state, control) {
        await this.continueQueue(control, actions);
    }
}
exports.SwitchToUserWorker = SwitchToUserWorker;
//# sourceMappingURL=SwitchToUserWorker.js.map