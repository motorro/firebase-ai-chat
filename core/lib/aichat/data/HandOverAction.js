"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHandBackAction = exports.isHandOverAction = void 0;
/**
 * Checks if data is a HandOverAction
 * @param data Data to check
 * @return True if data is HandOverAction
 */
function isHandOverAction(data) {
    return "object" === typeof data && null !== data && "name" in data && "handOver" === data.name;
}
exports.isHandOverAction = isHandOverAction;
/**
 * Checks if data is a HandBackAction
 * @param data Data to check
 * @return True if data is HandBackAction
 */
function isHandBackAction(data) {
    return "object" === typeof data && null !== data && "name" in data && "handBack" === data.name;
}
exports.isHandBackAction = isHandBackAction;
//# sourceMappingURL=HandOverAction.js.map