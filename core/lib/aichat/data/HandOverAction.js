"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandOverAction = isHandOverAction;
exports.isHandBackAction = isHandBackAction;
/**
 * Checks if data is a HandOverAction
 * @param data Data to check
 * @return True if data is HandOverAction
 */
function isHandOverAction(data) {
    return "object" === typeof data && null !== data && "name" in data && "handOver" === data.name;
}
/**
 * Checks if data is a HandBackAction
 * @param data Data to check
 * @return True if data is HandBackAction
 */
function isHandBackAction(data) {
    return "object" === typeof data && null !== data && "name" in data && "handBack" === data.name;
}
//# sourceMappingURL=HandOverAction.js.map