import {GoogleAuth} from "google-auth-library";
import {DeliverySchedule, Functions} from "firebase-admin/lib/functions";
import {ChatCommand} from "./data/ChatCommand";
import {logger} from "../logging";
import {HttpsError} from "firebase-functions/v2/https";
import {TaskScheduler} from "./TaskScheduler";
import {CloudTasksClient} from "@google-cloud/tasks";

export class FirebaseQueueTaskScheduler implements TaskScheduler {
    private readonly auth: GoogleAuth = new GoogleAuth({
        scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
    private readonly location: string;
    private readonly functions: Functions;

    constructor(functions: Functions, location: string) {
        this.functions = functions;
        this.location = location;
    }

    async schedule(queueName: string, command: ChatCommand, schedule?: DeliverySchedule): Promise<void> {
        const queue = this.functions.taskQueue(queueName);
        const uri = await this.getFunctionUrl(queueName, this.location);
        await queue.enqueue(command, {...(schedule || {}), uri: uri});
    }

    async getQueueMaxRetries(queueName: string): Promise<number> {
        const client = new CloudTasksClient();
        const queue = await client.getQueue({name: await this.getFunctionUrl(queueName, this.location)});
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
