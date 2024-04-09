import {
    AssistantChat,
    AiWrapper,
    ToolsDispatcher,
    FirebaseQueueTaskScheduler,
    ChatData,
    ChatState
} from "@motorro/firebase-ai-chat-core";
import {ChatWorker} from "./aichat/ChatWorker";
import {Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import {OpenAiAssistantConfig} from "./aichat/data/OpenAiAssistantConfig";
import {OpenAICommandScheduler} from "./aichat/OpenAICommandScheduler";

export {
    ChatData,
    ChatState,
    ChatStatus,
    ChatMessage,
    Meta,
    Logger,
    setLogger,
    TaskScheduler,
    Collections
} from "@motorro/firebase-ai-chat-core";
export {
    AiWrapper,
    ChatWorker,
    ToolsDispatcher,
    AssistantChat
};
export {OpenAiWrapper} from "./aichat/OpenAiWrapper";
export {OpenAiAssistantConfig} from "./aichat/data/OpenAiAssistantConfig";
export {OpenAiChatCommand} from "./aichat/data/OpenAiChatCommand";

/**
 * Chat state for OpenAI chats
 */
export type OpenAiChatState<DATA extends ChatData> = ChatState<OpenAiAssistantConfig, DATA>

/**
 * AI chat components to build Firestore functions
 */
export interface AiChat {
    /**
     * Chat user-facing callable functions
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @return Chat interface
     * @see worker
     */
    chat<DATA extends ChatData>(queueName: string): AssistantChat<OpenAiAssistantConfig, DATA>

    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @param dispatchers Tools dispatchers
     * @return Worker interface
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    worker(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker
}

/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @return Chat tools interface
 */
export function factory(firestore: Firestore, functions: Functions, location: string): AiChat {
    const scheduler = new FirebaseQueueTaskScheduler(functions, location);
    return {
        chat: function<DATA extends ChatData>(queueName: string): AssistantChat<OpenAiAssistantConfig, DATA> {
            return new AssistantChat<OpenAiAssistantConfig, DATA>(firestore, new OpenAICommandScheduler(queueName, scheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker {
            return new ChatWorker(firestore, scheduler, aiWrapper, dispatchers);
        }
    };
}