"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStructuredMessage = isStructuredMessage;
function isStructuredMessage(data) {
    return "object" === typeof data && null != data && "text" in data && "string" === typeof data.text;
}
//# sourceMappingURL=NewMessage.js.map