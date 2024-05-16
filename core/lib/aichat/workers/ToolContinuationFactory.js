"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolContinuationFactoryImpl = void 0;
const ToolsContinuationScheduler_1 = require("./ToolsContinuationScheduler");
const ToolsContinuationDispatchRunner_1 = require("./ToolsContinuationDispatchRunner");
const ToolsContinuationDispatcher_1 = require("./ToolsContinuationDispatcher");
class ToolContinuationFactoryImpl {
    constructor(db, 
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    dispatchers, scheduler) {
        this.db = db;
        this.dispatchers = dispatchers;
        this.scheduler = scheduler;
    }
    getDispatcher(chatDocumentPath, dispatcherId) {
        return new ToolsContinuationDispatcher_1.ToolsContinuationDispatcherImpl(chatDocumentPath, dispatcherId, this.db, new ToolsContinuationDispatchRunner_1.SequentialToolsContinuationDispatchRunner(this.dispatchers));
    }
    getScheduler(queueName) {
        return new ToolsContinuationScheduler_1.ToolContinuationSchedulerImpl(queueName, this.db, this.scheduler);
    }
}
exports.ToolContinuationFactoryImpl = ToolContinuationFactoryImpl;
//# sourceMappingURL=ToolContinuationFactory.js.map