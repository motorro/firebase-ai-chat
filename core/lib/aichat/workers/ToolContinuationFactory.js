"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolContinuationFactoryImpl = void 0;
const ToolsContinuation_1 = require("./ToolsContinuation");
const ToolsContinuationDispatchRunner_1 = require("./ToolsContinuationDispatchRunner");
const ToolsContinuationDispatcher_1 = require("./ToolsContinuationDispatcher");
const ToolContinuationWorker_1 = require("./ToolContinuationWorker");
class ToolContinuationFactoryImpl {
    constructor(db, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers, scheduler) {
        this.db = db;
        this.dispatchers = dispatchers;
        this.scheduler = scheduler;
    }
    getDispatcher(commonData, dispatcherId) {
        return new ToolsContinuationDispatcher_1.ToolsContinuationDispatcherImpl(commonData, dispatcherId, this.db, new ToolsContinuationDispatchRunner_1.ToolsContinuationDispatchRunner(this.dispatchers));
    }
    getContinuation(queueName) {
        return new ToolsContinuation_1.ToolContinuationImpl(queueName, this.db, this.scheduler);
    }
    getWorker(isSupportedMeta, onResolved) {
        return new ToolContinuationWorker_1.ToolContinuationWorker(isSupportedMeta, onResolved, this.db, this.scheduler, new ToolsContinuationDispatchRunner_1.ToolsContinuationDispatchRunner(this.dispatchers));
    }
}
exports.ToolContinuationFactoryImpl = ToolContinuationFactoryImpl;
//# sourceMappingURL=ToolContinuationFactory.js.map