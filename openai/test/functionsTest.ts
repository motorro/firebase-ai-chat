import * as fs from "fs";
import * as admin from "firebase-admin";
import {getFunctions} from "firebase-admin/functions";
import {setLogger} from "@motorro/firebase-ai-chat-core";
import {Logger} from "../../core/src";

type RC = {
    projects: {[key: string]: string}
}
const config: RC = JSON.parse(fs.readFileSync("../.firebaserc", "utf8"));

const ConsoleLogger: Logger = {
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
setLogger(ConsoleLogger);

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const test = require("firebase-functions-test")(
    {
        projectId: config.projects["test"]
    },
    "../keys/test.json"
);

admin.initializeApp();

export const db = admin.firestore();
export const functions = getFunctions();
