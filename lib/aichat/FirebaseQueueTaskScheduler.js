"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseQueueTaskScheduler = void 0;
const google_auth_library_1 = require("google-auth-library");
const logging_1 = require("../logging");
const https_1 = require("firebase-functions/v2/https");
class FirebaseQueueTaskScheduler {
    constructor(functions, location) {
        this.auth = new google_auth_library_1.GoogleAuth({
            scopes: "https://www.googleapis.com/auth/cloud-platform",
        });
        this.functions = functions;
        this.location = location;
    }
    async schedule(name, command, schedule) {
        const queue = this.functions.taskQueue(name);
        const uri = await this.getFunctionUrl(name, this.location);
        await queue.enqueue(command, Object.assign(Object.assign({}, schedule), { uri: uri }));
    }
    async getFunctionUrl(name, location) {
        const projectId = await this.auth.getProjectId();
        const url = `https://cloudfunctions.googleapis.com/v2beta/projects/${projectId}/locations/${location}/functions/${name}`;
        const client = await this.auth.getClient();
        const data = (await client.request({ url })).data;
        if (!data) {
            logging_1.logger.e(`Google auth - no data`);
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        const config = data["serviceConfig"];
        if (!config) {
            logging_1.logger.e(`Google auth - no config`);
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        const uri = config.uri;
        if (!uri) {
            logging_1.logger.e(`Google auth - no uri`);
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        return uri;
    }
}
exports.FirebaseQueueTaskScheduler = FirebaseQueueTaskScheduler;
//# sourceMappingURL=FirebaseQueueTaskScheduler.js.map