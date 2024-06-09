"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseQueueTaskScheduler = void 0;
const google_auth_library_1 = require("google-auth-library");
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const tasks_1 = require("@google-cloud/tasks");
const logging_1 = require("../logging");
const logger = (0, logging_1.tagLogger)("FirebaseQueueTaskScheduler");
class FirebaseQueueTaskScheduler {
    /**
     * Constructor
     * @param functions Functions instance
     * @param region Service region
     * @param defaultSchedule Default scheduling region to merge with those passed to schedule method
     */
    constructor(functions, region, defaultSchedule) {
        this.auth = new google_auth_library_1.GoogleAuth({
            scopes: "https://www.googleapis.com/auth/cloud-platform"
        });
        this.functions = functions;
        this.region = region;
        this.defaultSchedule = defaultSchedule || {};
    }
    async schedule(queueName, command, schedule) {
        logger.d(`Dispatching to ${queueName} at ${this.region}:`, JSON.stringify(command));
        const queue = this.functions.taskQueue(`locations/${this.region}/functions/${queueName}`);
        const uri = await this.getFunctionUrl(queueName, this.region);
        const toEnqueue = Array.isArray(command) ? command : [command];
        const options = Object.assign(Object.assign({}, (schedule || this.defaultSchedule || {})), { uri: uri });
        await Promise.all(toEnqueue.map((it) => queue.enqueue(it, options)));
    }
    async getQueueMaxRetries(queueName) {
        var _a;
        const client = new tasks_1.CloudTasksClient();
        const name = `projects/${params_1.projectID.value()}/locations/${this.region}/queues/${queueName}`;
        const queue = await client.getQueue({ name: name });
        return ((_a = queue[0].retryConfig) === null || _a === void 0 ? void 0 : _a.maxAttempts) || 0;
    }
    async getFunctionUrl(name, location) {
        const projectId = await this.auth.getProjectId();
        const url = `https://cloudfunctions.googleapis.com/v2beta/projects/${projectId}/locations/${location}/functions/${name}`;
        const client = await this.auth.getClient();
        const data = (await client.request({ url })).data;
        if (!data) {
            logger.e("Google auth - no data");
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const config = data["serviceConfig"];
        if (!config) {
            logger.e("Google auth - no config");
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        const uri = config.uri;
        if (!uri) {
            logger.e("Google auth - no uri");
            return Promise.reject(new https_1.HttpsError("not-found", "Not found"));
        }
        return uri;
    }
}
exports.FirebaseQueueTaskScheduler = FirebaseQueueTaskScheduler;
//# sourceMappingURL=FirebaseQueueTaskScheduler.js.map