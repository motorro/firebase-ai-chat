/**
 * Logger
 */
export type Logger = {
    /**
     * Logs with DEBUG level
     * @param args
     */
    d: (...args: unknown[]) => void,
    /**
     * Logs with INFO level
     * @param args
     */
    i: (...args: unknown[]) => void,
    /**
     * Logs with WARN level
     * @param args
     */
    w: (...args: unknown[]) => void,
    /**
     * Logs with ERROR level
     * @param args
     */
    e: (...args: unknown[]) => void
}

export const ConsoleLogger: Logger = {
    d(...args: unknown[]): void {
        console.debug(...args);
    },
    i(...args: unknown[]): void {
        console.info(...args);
    },
    w(...args: unknown[]): void {
        console.warn(...args);
    },
    e(...args: unknown[]): void {
        console.error(...args);
    }
};

export let logger: Logger = ConsoleLogger;

/**
 * Sets the logger
 * @param instance Logger instance
 */
export function setLogger(instance: Logger) {
    logger = instance;
}

/**
 * Adds a tag to the logger
 * @param tag Logging tag
 * @return Tagged logger
 */
export function tagLogger(tag: string): Logger {
    const tagStr = `${tag}:`;
    return {
        d(...args: unknown[]): void {
            logger.d(...[tagStr, ...args]);
        },
        i(...args: unknown[]): void {
            logger.i(...[tagStr, ...args]);
        },
        w(...args: unknown[]): void {
            logger.w(...[tagStr, ...args]);
        },
        e(...args: unknown[]): void {
            logger.e(...[tagStr, ...args]);
        }
    };
}

