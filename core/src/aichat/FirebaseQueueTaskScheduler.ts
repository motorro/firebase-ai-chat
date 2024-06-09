import {GoogleAuth} from "google-auth-library";
import {DeliverySchedule, Functions} from "firebase-admin/functions";
import {projectID} from "firebase-functions/params";
import {HttpsError} from "firebase-functions/v2/https";
import {TaskScheduler} from "./TaskScheduler";
import {CloudTasksClient} from "@google-cloud/tasks";
import {tagLogger} from "../logging";

const logger = tagLogger("FirebaseQueueTaskScheduler");

export class FirebaseQueueTaskScheduler<Args extends Record<string, unknown> = Record<string, unknown>> implements TaskScheduler<Args> {
    private readonly auth: GoogleAuth = new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform"
    });
    private readonly region: string;
    private readonly functions: Functions;
    private readonly defaultSchedule: DeliverySchedule;

    /**
     * Constructor
     * @param functions Functions instance
     * @param region Service region
     * @param defaultSchedule Default scheduling region to merge with those passed to schedule method
     */
    constructor(functions: Functions, region: string, defaultSchedule?: DeliverySchedule) {
        this.functions = functions;
        this.region = region;
        this.defaultSchedule = defaultSchedule || {};
    }

    async schedule(queueName: string, command: Args | ReadonlyArray<Args>, schedule?: DeliverySchedule): Promise<void> {
        logger.d(`Dispatching to ${queueName} at ${this.region}:`, JSON.stringify(command));
        const queue = this.functions.taskQueue(`locations/${this.region}/functions/${queueName}`);
        const uri = await this.getFunctionUrl(queueName, this.region);
        const toEnqueue = Array.isArray(command) ? command : [command];
        const options = {
            ...(schedule || this.defaultSchedule || {}),
            uri: uri
        };
        await Promise.all(toEnqueue.map((it) => queue.enqueue(it, options)));
    }

    async getQueueMaxRetries(queueName: string): Promise<number> {
        const client = new CloudTasksClient();
        const name = `projects/${projectID.value()}/locations/${this.region}/queues/${queueName}`;
        const queue = await client.getQueue({name: name});
        return queue[0].retryConfig?.maxAttempts || 0;
    }

    private async getFunctionUrl(name: string, location: string): Promise<string> {
        const projectId = await this.auth.getProjectId();
        const url = `https://cloudfunctions.googleapis.com/v2beta/projects/${projectId}/locations/${location}/functions/${name}`;
        const client = await this.auth.getClient();
        const data = (await client.request({url})).data;
        if (!data) {
            logger.e("Google auth - no data");
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const config = (data as Record<string, any>)["serviceConfig"];
        if (!config) {
            logger.e("Google auth - no config");
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        const uri = config.uri;
        if (!uri) {
            logger.e("Google auth - no uri");
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        return uri;
    }
}
