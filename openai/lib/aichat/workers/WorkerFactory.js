"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerFactory = void 0;
class WorkerFactory {
    /**
     * Constructor
     * @param firestore Firestore reference
     * @param scheduler Task scheduler
     * @param wrapper AI wrapper
     */
    constructor(firestore, scheduler, wrapper) {
        this.firestore = firestore;
        this.scheduler = scheduler;
        this.wrapper = wrapper;
    }
}
exports.WorkerFactory = WorkerFactory;
//# sourceMappingURL=WorkerFactory.js.map