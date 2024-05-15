"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolvedContinuation = exports.SuspendedContinuation = exports.Continuation = void 0;
const CONTINUATION_SYMBOL = Symbol("continuation");
class Continuation {
    constructor() { }
    static isContinuation(smth) {
        return "object" === typeof smth && null !== smth && CONTINUATION_SYMBOL in smth;
    }
    static suspend() {
        return SuspendedContinuation.getInstance();
    }
    static resolve(value) {
        return new ResolvedContinuation(value);
    }
    toString() {
        return `Continuation: resolved: ${this.isResolved()}, value: ${this.value}`;
    }
}
exports.Continuation = Continuation;
_a = CONTINUATION_SYMBOL;
Continuation[_a] = CONTINUATION_SYMBOL;
class SuspendedContinuation extends Continuation {
    get value() {
        throw new Error("Trying to get value from suspended continuation");
    }
    constructor() {
        super();
    }
    isSuspended() {
        return true;
    }
    isResolved() {
        return false;
    }
    static getInstance() {
        if (null === SuspendedContinuation.instance) {
            SuspendedContinuation.instance = new SuspendedContinuation();
        }
        return SuspendedContinuation.instance;
    }
}
exports.SuspendedContinuation = SuspendedContinuation;
SuspendedContinuation.instance = null;
class ResolvedContinuation extends Continuation {
    get value() {
        return this.data;
    }
    constructor(value) {
        super();
        this.data = value;
    }
    isSuspended() {
        return false;
    }
    isResolved() {
        return true;
    }
}
exports.ResolvedContinuation = ResolvedContinuation;
//# sourceMappingURL=Continuation.js.map