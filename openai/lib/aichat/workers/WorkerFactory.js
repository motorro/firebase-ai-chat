"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerFactory = void 0;
const engineId_1 = require("../../engineId");
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
    /**
     * Checks if command is supported
     * @param command Command to check
     * @return True if command is supported
     */
    isSupportedCommand(command) {
        return "engine" in command && engineId_1.engineId === command.engine
            && Array.isArray(command.actionData)
            && undefined !== command.actionData[0]
            && this.isSupportedAction(command.actionData[0]);
    }
    /**
     * Is supported Open AI action
     * @param action Command to check
     * @returns true if worker supports the command
     * @protected
     */
    isSupportedAction(action) {
        return false;
    }
}
exports.WorkerFactory = WorkerFactory;
//# sourceMappingURL=WorkerFactory.js.map