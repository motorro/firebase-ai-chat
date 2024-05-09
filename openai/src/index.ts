import {
    AssistantChat,
    ToolsDispatcher,
    FirebaseQueueTaskScheduler,
    ChatData,
    ChatState,
    TaskScheduler,
    CommandScheduler
} from "@motorro/firebase-ai-chat-core";
import {AiWrapper} from "./aichat/AiWrapper";
import {OpenAiChatWorker} from "./aichat/OpenAiChatWorker";
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
    CommandScheduler,
    Collections
} from "@motorro/firebase-ai-chat-core";
export {
    AiWrapper,
    OpenAiChatWorker,
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
     * Creates default command scheduler that schedules commands to dispatch
     * @param queueName Provides queue name to schedule tasks to
     * @param taskScheduler Provides task-schedule to put tasks to queue
     * @return Array of default task schedulers for this library
     */
    createDefaultCommandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler>

    /**
     * Chat user-facing callable functions
     * @param queueName Chat dispatcher function (queue) name to dispatch work
     * @return Chat interface
     * @see worker
     */
    chat<DATA extends ChatData>(queueName: string): AssistantChat<DATA>

    /**
     * Chat worker to use in Firebase tasks
     * @param aiWrapper AI API wrapper
     * @param dispatchers Tools dispatchers
     * @return Worker interface
     */
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    worker(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): OpenAiChatWorker
}

/**
 * Chat tools factory
 * @param firestore Firestore instance
 * @param functions Functions instance
 * @param location Function location
 * @param taskScheduler Task scheduler that puts tasks to queue
 * @return Chat tools interface
 */
export function factory(
    firestore: Firestore,
    functions: Functions,
    location: string,
    taskScheduler?: TaskScheduler
): AiChat {
    const _taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);

    function defaultSchedulers(queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> {
        return [new OpenAICommandScheduler(queueName, taskScheduler)];
    }

    return {
        createDefaultCommandSchedulers: defaultSchedulers,
        chat: function<DATA extends ChatData>(
            queueName: string,
            commandSchedulers: (queueName: string, taskScheduler: TaskScheduler) => ReadonlyArray<CommandScheduler> = defaultSchedulers
        ): AssistantChat<DATA> {
            return new AssistantChat<DATA>(firestore, commandSchedulers(queueName, _taskScheduler));
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): OpenAiChatWorker {
            return new OpenAiChatWorker(firestore, _taskScheduler, aiWrapper, dispatchers);
        }
    };
}
