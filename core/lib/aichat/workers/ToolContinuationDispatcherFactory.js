"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolContinuationDispatcherFactoryImpl = void 0;
const ToolsContinuationDispatchRunner_1 = require("./ToolsContinuationDispatchRunner");
const ToolsContinuationDispatcher_1 = require("./ToolsContinuationDispatcher");
class ToolContinuationDispatcherFactoryImpl {
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
}
exports.ToolContinuationDispatcherFactoryImpl = ToolContinuationDispatcherFactoryImpl;
//# sourceMappingURL=ToolContinuationDispatcherFactory.js.map