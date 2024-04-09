import {firestore} from "firebase-admin";
import Timestamp = firestore.Timestamp;

/**
 * Operation dispatch record
 */
export interface Dispatch {
    createdAt: Timestamp
}

/**
 * Command run status
 */
export type RunStatus = "running" | "complete" | "waitingForRetry"

/**
 * Command run state
 */
export interface Run {
    status: RunStatus,
    runAttempt: number,
    createdAt: Timestamp,
}
