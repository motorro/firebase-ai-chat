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
      const ai = chatFactory.ai(model, VERTEXAI_THREADS)

      // Dispatch request  
      await chatFactory.worker(ai, instructions).dispatch(
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
