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

export function setLogger(instance: Logger) {
    logger = instance;
}

