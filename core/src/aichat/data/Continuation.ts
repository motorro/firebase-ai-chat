
const CONTINUATION_SYMBOL: unique symbol = Symbol("continuation");

export abstract class Continuation<out DATA> {
    abstract get value(): DATA;

    static [CONTINUATION_SYMBOL]: typeof CONTINUATION_SYMBOL = CONTINUATION_SYMBOL;

    protected constructor() { }

    static isContinuation<DATA>(smth: unknown): smth is Continuation<DATA> {
        return "object" === typeof smth && null !== smth && CONTINUATION_SYMBOL in smth;
    }
    abstract isSuspended(): this is SuspendedContinuation
    abstract isResolved(): this is ResolvedContinuation<DATA>

    static suspend(): Continuation<never> {
        return SuspendedContinuation.getInstance();
    }
    static resolve<DATA>(value: DATA): Continuation<DATA> {
        return new ResolvedContinuation(value);
    }

    toString(): string {
        return `Continuation: resolved: ${this.isResolved()}, value: ${this.value}`
    }
}

export class SuspendedContinuation extends Continuation<never> {
    get value(): never {
        throw new Error("Trying to get value from suspended continuation");
    }

    private constructor() {
        super();
    }

    isSuspended(): this is SuspendedContinuation {
        return true;
    }
    isResolved(): this is ResolvedContinuation<never> {
        return false;
    }

    private static instance: SuspendedContinuation | null = null;

    static getInstance(): SuspendedContinuation {
        if (null === SuspendedContinuation.instance) {
            SuspendedContinuation.instance = new SuspendedContinuation();
        }
        return SuspendedContinuation.instance;
    }
}

export class ResolvedContinuation<out DATA> extends Continuation<DATA> {
    private readonly data: DATA;
    get value(): DATA {
        return this.data;
    }

    constructor(value: DATA) {
        super();
        this.data = value;
    }

    isSuspended(): this is SuspendedContinuation {
        return false;
    }
    isResolved(): this is ResolvedContinuation<DATA> {
        return true;
    }
}