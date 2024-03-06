import {AssistantChat} from "./aichat/AssistantChat";
import {AiWrapper} from "./aichat/AiWrapper";
import {ChatWorker} from "./aichat/ChatWorker";
import {ToolsDispatcher} from "./aichat/ToolsDispatcher";
import {DeliverySchedule, Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import {FirebaseQueueTaskScheduler} from "./aichat/FirebaseQueueTaskScheduler";
import {ChatData} from "./aichat/data/ChatState";

export {ChatStatus} from "./aichat/data/ChatStatus";
export {ChatData, ChatState} from "./aichat/data/ChatState";
export {ChatMessage} from "./aichat/data/ChatMessage";
export {ChatCommandQueue} from "./aichat/data/ChatCommandQueue";
export {Logger, setLogger} from "./logging";
export {AiWrapper};
export {OpenAiWrapper} from "./aichat/OpenAiWrapper";
export {ChatWorker};
export {ToolsDispatcher};
export {AssistantChat};
export {TaskScheduler} from "./aichat/TaskScheduler";
export {Collections} from "./aichat/data/Collections";

/**
 * AI chat components to build Firestore functions
 */
export interface AiChat {
    /**
     * Chat user-facing callable functions
     * @param name Chat name for command dispatcher
     * @return Chat interface
     */
    chat<DATA extends ChatData>(name: string, scheduling: DeliverySchedule): AssistantChat<DATA>

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
        chat: function<DATA extends ChatData>(name: string): AssistantChat<DATA> {
            return new AssistantChat<DATA>(firestore, name, scheduler);
        },
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        worker: function(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker {
            return new ChatWorker(firestore, scheduler, aiWrapper, dispatchers);
        }
    };
}
