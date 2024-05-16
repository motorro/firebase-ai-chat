import { ChatWorker } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { WorkerFactory } from "./WorkerFactory";
export declare class RetrieveFactory extends WorkerFactory {
    protected isSupportedAction(action: unknown): action is OpenAiChatAction;
    create(): ChatWorker;
}
