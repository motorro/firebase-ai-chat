import {GoogleAuth} from "google-auth-library";
import {DeliverySchedule, Functions} from "firebase-admin/lib/functions";
import {ChatCommand} from "./data/ChatCommand";
import {logger} from "../logging";
import {HttpsError} from "firebase-functions/v2/https";
import {TaskScheduler} from "./TaskScheduler";

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

    async schedule(name: string, command: ChatCommand, schedule: DeliverySchedule): Promise<void> {
        const queue = this.functions.taskQueue(name);
        const uri = await this.getFunctionUrl(name, this.location);
        await queue.enqueue(command, {...schedule, uri: uri});
    }

    private async getFunctionUrl(name: string, location: string): Promise<string> {
        const projectId = await this.auth.getProjectId();
        const url = `https://cloudfunctions.googleapis.com/v2beta/projects/${projectId}/locations/${location}/functions/${name}`;
        const client = await this.auth.getClient();
        const data = (await client.request({url})).data;
        if (!data) {
            logger.e(`Google auth - no data`);
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        const config = (data as Record<string, any>)["serviceConfig"];
        if (!config) {
            logger.e(`Google auth - no config`);
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        const uri = config.uri;
        if (!uri) {
            logger.e(`Google auth - no uri`);
            return Promise.reject(new HttpsError("not-found", "Not found"));
        }
        return uri;
    }
}