import { ChatWorker } from "@motorro/firebase-ai-chat-core";
import { OpenAiChatAction } from "../data/OpenAiChatAction";
import { WorkerFactory } from "./WorkerFactory";
export declare class PostFactory extends WorkerFactory {
    isSupportedAction(action: unknown): action is OpenAiChatAction;
    create(): ChatWorker;
}
