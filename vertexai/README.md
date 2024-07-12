# Firebase VertexAI chat library
[![Check](https://github.com/motorro/firebase-ai-chat/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/motorro/firebase-openai-chat/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-vertexai.svg)](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-vertexai)

OpenAI chat library. 
See [top-level](https://github.com/motorro/firebase-ai-chat) documentation for complete reference.

### VertexAI setup
We also need to set up the VertexAI API. To do this we need prepare the model, [wrapper](src/aichat/AiWrapper.ts) and 
[instructions](src/aichat/data/VertexAiSystemInstructions.ts) bound to the ID or your chat [assistant config](src/aichat/data/VertexAiAssistantConfig.ts):

```typescript
import {projectID} from "firebase-functions/params";
import {VertexAI} from "@google-cloud/vertexai";
import {factory} from "@motorro/firebase-ai-chat-vertexai";

// Chat component factory
const chatFactory = factory(firestore(), getFunctions(), region);

// Create VertexAI adapter
const ai = chatFactory.ai(model, "/threads")

// Your assistant system instructions bound to assistant ID in chat config
const instructions: Readonly<Record<string, VertexAiSystemInstructions<any>>> = {
    "yourAssistantId": {
        instructions: instructions2,
        tools: {
            dispatcher: (dataSoFar, name, args) => dataSoFar,
            definition: [
                {functionDeclarations: [{name: "someFunction"}]}
            ]
        }
    }
}

const options: CallableOptions = {
  secrets: [openAiApiKey],
  region: region,
  invoker: "public"
};
```

### Optional custom message mapper
By default, the library uses only text messages as-is. But if you want custom message processing, say image processing
or adding some metadata, you could create your own AI message processor and supply it to chat factory `worker` method.
Default message mapper could be found [here](src/aichat/VertexAiMessageMapper.ts).

```typescript
const myMessageMapper: VertexAiMessageMapper = {
    toAi(message: NewMessage): Array<Part> {
        throw new Error("TODO: Implement mapping from Chat to OpenAI");
    },

    fromAi(message: GenerateContentCandidate): NewMessage | undefined {
        throw new Error("TODO: Implement OpenAI to Chat message mapping")
    }
}
```

### Custom resource cleaner
When you close the chat, the library cleans up the threads that were created during the chat. If you need any custom 
processing, you may add some custom cleaner that will be called along:
```typescript
/**
 * Chat resource cleaner
 */
const cleaner: ChatCleaner = {
    /**
     * Schedules cleanup commands stored inside chat data
     * @param chatDocumentPath Chat document
     */
    cleanup: async (chatDocumentPath: string): Promise<void> => {
        logger.d("Cleanup");
    }
}
```

### Optional middleware
By default, the library saves all the messages that come from AI. If you need any custom processing, you could add some
custom AI message middleware. Take a look at the main documentation for details [here](../README.md#message-middleware).
```typescript
const handOver: MessageMiddleware<CalculateChatData, CalculatorMeta> = chatFactory.handOverMiddleware(
    "calculator",
    handOverProcessor
);
```

### Command dispatcher configuration
The requests to front-facing functions return to user as fast as possible after changing the chat state in Firestore.
As soon as the AI run could take a considerable time, we run theme in a Cloud Task "offline" from the client request.
To execute the Assistant run we use the second class from the library - the [VertexAiChatWorker](src/aichat/VertexAiChatWorker.ts).
To create it, use the [AiChat](src/index.ts) factory we created as described in the [main documentation](https://github.com/motorro/firebase-ai-chat).

To register the Cloud Task handler you may want to create the following function:

```typescript
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import {firestore} from "firebase-admin";
import {getFunctions} from "firebase-admin/functions";

// Function region
const region = "europe-west1";
// Collection path to store threads
const VERTEXAI_THREADS = "treads";

export const calculator = onTaskDispatched(
    {
      retryConfig: {
        maxAttempts: 1,
        minBackoffSeconds: 30
      },
      rateLimits: {
        maxConcurrentDispatches: 6
      },
      region: region
    },
    async (req) => {
      // Create and run a worker
      // See the `dispatchers` definitions below
      const vertexAi = new VertexAI({
          project: projectID.value(),
          location: region
      });
      const model = vertexAi.getGenerativeModel(
          {
              model: "gemini-1.0-pro",
              generationConfig: {
                  candidateCount: 1
              }
          },
          {
              timeout: 30 * 1000
          }
      );

      // Dispatch request  
      await chatFactory.worker(
          model, 
          VERTEXAI_THREADS, 
          instructions, 
          myMessageMapper, 
          cleaner, 
          [handOver]
      ).dispatch(
          req,
          (chatDocumentPath: string, meta: Meta) => {
             // Optional task completion handler
             // Meta - some meta-data passed to chat operation
          }   
      );
    }
);
```
The `VertexAiChatWorker` handles the [VertexAiChatCommand](src/aichat/data/VertexAiChatCommand.ts) and updates [VertexAiChatState](src/index.ts)
with the results.

Full example is available in the [sample Firebase project](https://github.com/motorro/firebase-openai-chat-project/blob/master/Firebase/functions/src/vertexai/vertexai.ts).
