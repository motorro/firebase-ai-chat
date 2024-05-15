"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchToUserFactory = void 0;
const WorkerFactory_1 = require("./WorkerFactory");
const OpenAiQueueWorker_1 = require("./OpenAiQueueWorker");
class SwitchToUserWorker extends OpenAiQueueWorker_1.OpenAiQueueWorker {
    async doDispatch(actions, _data, _state, control) {
        await this.continueQueue(control, actions);
    }
}
class SwitchToUserFactory extends WorkerFactory_1.WorkerFactory {
    isSupportedAction(action) {
        return "switchToUserInput" === action;
    }
    create() {
        return new SwitchToUserWorker(this.firestore, this.scheduler, this.wrapper);
    }
}
exports.SwitchToUserFactory = SwitchToUserFactory;
//# sourceMappingURL=SwitchToUserWorker.js.map