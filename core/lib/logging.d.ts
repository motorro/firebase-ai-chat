/**
 * Logger
 */
export type Logger = {
    /**
     * Logs with DEBUG level
     * @param args
     */
    d: (...args: unknown[]) => void;
    /**
     * Logs with INFO level
     * @param args
     */
    i: (...args: unknown[]) => void;
    /**
     * Logs with WARN level
     * @param args
     */
    w: (...args: unknown[]) => void;
    /**
     * Logs with ERROR level
     * @param args
     */
    e: (...args: unknown[]) => void;
};
export declare const ConsoleLogger: Logger;
export declare let logger: Logger;
export declare function setLogger(instance: Logger): void;
