declare const CONTINUATION_SYMBOL: unique symbol;
export declare abstract class Continuation<out DATA> {
    /**
     * Stored value or an exception
     */
    abstract get value(): DATA;
    CONTINUATION: typeof CONTINUATION_SYMBOL;
    static isContinuation<DATA>(smth: unknown): smth is Continuation<DATA>;
    abstract isSuspended(): this is SuspendedContinuation;
    abstract isResolved(): this is ResolvedContinuation<DATA>;
    static suspend(): Continuation<never>;
    static resolve<DATA>(value: DATA): Continuation<DATA>;
    toString(): string;
}
export declare class SuspendedContinuation extends Continuation<never> {
    get value(): never;
    private constructor();
    isSuspended(): this is SuspendedContinuation;
    isResolved(): this is ResolvedContinuation<never>;
    private static instance;
    static getInstance(): SuspendedContinuation;
}
export declare class ResolvedContinuation<out DATA> extends Continuation<DATA> {
    private readonly data;
    get value(): DATA;
    constructor(value: DATA);
    isSuspended(): this is SuspendedContinuation;
    isResolved(): this is ResolvedContinuation<DATA>;
}
export {};
