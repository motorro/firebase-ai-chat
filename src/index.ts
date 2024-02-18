import {AssistantChat} from "./aichat/AssistantChat";
import {AiWrapper} from "./aichat/AiWrapper";
import {ChatWorker} from "./aichat/ChatWorker";
import {ToolsDispatcher} from "./aichat/ToolsDispatcher";
import {DeliverySchedule, Functions} from "firebase-admin/lib/functions";
import {firestore} from "firebase-admin";
import Firestore = firestore.Firestore;
import {FirebaseQueueTaskScheduler} from "./aichat/FirebaseQueueTaskScheduler";

export {ChatStatus} from "./aichat/data/ChatStatus";
export {ChatState} from "./aichat/data/ChatState";
export {ChatMessage} from "./aichat/data/ChatMessage";
export {ChatCommand} from "./aichat/data/ChatCommand";
export {Logger, setLogger} from "./logging";
export {OpenAiWrapper} from "./aichat/OpenAiWrapper";
export {ChatWorker};
export {ToolsDispatcher};
export {AssistantChat};
export {AiWrapper};
export {TaskScheduler} from "./aichat/TaskScheduler";
export {Collections} from "./aichat/data/Collections";

export interface AiChat {
    chat<DATA extends object>(name: string, location: string, scheduling: DeliverySchedule): AssistantChat<DATA>
    worker(aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker
}

export function factory(firestore: Firestore, functions: Functions): AiChat {
    return {
        worker: function (aiWrapper: AiWrapper, dispatchers: Readonly<Record<string, ToolsDispatcher<any>>>): ChatWorker {
            return new ChatWorker(firestore, aiWrapper, dispatchers)
        },
        chat: function<DATA extends object>(name: string, location: string, scheduling: DeliverySchedule = {}): AssistantChat<DATA> {
            const scheduler = new FirebaseQueueTaskScheduler(functions, location);
            return new AssistantChat<DATA>(firestore, name, scheduler, scheduling);
        }
    }
}
