"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tagLogger = exports.setLogger = exports.logger = exports.ConsoleLogger = void 0;
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
/**
 * Sets the logger
 * @param instance Logger instance
 */
function setLogger(instance) {
    exports.logger = instance;
}
exports.setLogger = setLogger;
/**
 * Adds a tag to the logger
 * @param tag Logging tag
 * @return Tagged logger
 */
function tagLogger(tag) {
    const tagStr = `${tag}:`;
    return {
        d(...args) {
            exports.logger.d(...[tagStr, ...args]);
        },
        i(...args) {
            exports.logger.i(...[tagStr, ...args]);
        },
        w(...args) {
            exports.logger.w(...[tagStr, ...args]);
        },
        e(...args) {
            exports.logger.e(...[tagStr, ...args]);
        }
    };
}
exports.tagLogger = tagLogger;
//# sourceMappingURL=logging.js.map