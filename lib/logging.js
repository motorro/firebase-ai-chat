"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogger = exports.logger = exports.ConsoleLogger = void 0;
exports.ConsoleLogger = {
    d(...args) {
        console.debug(...args);
    },
    i(...args) {
        console.info(...args);
    },
    w(...args) {
        console.warn(...args);
    },
    e(...args) {
        console.error(...args);
    }
};
exports.logger = exports.ConsoleLogger;
function setLogger(instance) {
    exports.logger = instance;
}
exports.setLogger = setLogger;
//# sourceMappingURL=logging.js.map