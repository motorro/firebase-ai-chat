import * as fs from "fs";
import {setLogger} from "../lib";
import {ConsoleLogger} from "../lib/logging";
import * as admin from "firebase-admin";
import {getFunctions} from "firebase-admin/functions";

type RC = {
    projects: {[key: string]: string}
}
const config: RC = JSON.parse(fs.readFileSync("../.firebaserc", "utf8"));

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
