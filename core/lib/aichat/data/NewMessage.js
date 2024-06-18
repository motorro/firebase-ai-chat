"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStructuredMessage = void 0;
function isStructuredMessage(data) {
    return "object" === typeof data && null != data && "text" in data && "string" === typeof data.text;
}
exports.isStructuredMessage = isStructuredMessage;
//# sourceMappingURL=NewMessage.js.map