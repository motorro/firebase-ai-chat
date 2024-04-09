# Firebase OpenAI chat library
[![Check](https://github.com/motorro/firebase-ai-chat/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/motorro/firebase-openai-chat/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-openai.svg)](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-openai)

OpenAI chat library. 
See [top-level](https://github.com/motorro/firebase-ai-chat) documentation for complete reference.

### OpenAI setup
We also need to set up the OpenAI API. To do this we need to get the OpenAI API key and to define the used assistant ID:

```typescript
const region = "europe-west1";
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const openAiAssistantId = defineString("OPENAI_ASSISTANT_ID");

const options: CallableOptions = {
  secrets: [openAiApiKey],
  region: region,
  invoker: "public"
};
```

Refer to [Configure your environment](https://firebase.google.com/docs/functions/config-env) article for more
information on setting environment and secret variables for your functions.

### Command dispatcher configuration
The requests to front-facing functions return to user as fast as possible after changing the chat state in Firestore.
As soon as the AI run could take a considerable time, we run theme in a Cloud Task "offline" from the client request.
To execute the Assistant run we use the second class from the library - the [ChatWorker](src/aichat/ChatWorker.ts).
To create it, use the [AiChat](src/index.ts) factory we created as described in the [main documentation](https://github.com/motorro/firebase-ai-chat).

To register the Cloud Task handler you may want to create the following function:

```typescript
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import OpenAI from "openai";
import {OpenAiWrapper, Meta} from "firebase-openai-chat";

export const calculator = onTaskDispatched(
    {
      secrets: [openAiApiKey],
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
      // Create OpenAI API instance and OpenAI adapter
      const ai = new OpenAiWrapper(new OpenAI({apiKey: openAiApiKey.value()}));
      // Create and run a worker
      // See the `dispatchers` definitions below
      await chatFactory.worker(ai, dispatchers).dispatch(
          req,
          (chatDocumentPath: string, meta: Meta) => {
             // Optional task completion handler
             // Meta - some meta-data passed to chat operation
          }   
      );
    }
);
```
The `ChatWorker` handles the [ChatCommand](src/aichat/data/ChatCommandQueue.ts) and updates [ChatState](src/aichat/data/ChatState.ts)
with the results.