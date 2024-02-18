import * as fs from "fs";
import {setLogger} from "../lib";
import {ConsoleLogger} from "../lib/logging";
import * as admin from "firebase-admin";
import {getFunctions} from "firebase-admin/functions";

type RC = {
    projects: {[key: string]: string}
}
const config: RC = JSON.parse(fs.readFileSync("./.firebaserc", "utf8"));

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";

setLogger(ConsoleLogger);

export const test = require("firebase-functions-test")(
    {
        projectId: config.projects["test"]
    },
    "../keys/test.json"
);
require("firebase-functions-test")(
    {
        projectId: {projectId: config.projects["test"]}
    },
    "./keys/test.json"
);

admin.initializeApp();

export const db = admin.firestore();
export const functions = getFunctions();
