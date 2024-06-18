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

### Optional custom message mapper
By default, the library uses only text messages as-is. But if you want custom message processing, say image processing 
or adding some metadata, you could create your own AI message processor and supply it to chat factory `worker` method. 
Default message mapper could be found [here](src/aichat/OpenAiMessageMapper.ts).

```typescript
const myMessageMapper: OpenAiMessageMapper = {
    toAi(message: NewMessage): UserMessageParts {
        throw new Error("TODO: Implement mapping from Chat to OpenAI");
    },

    fromAi(message: Message): NewMessage | undefined {
        throw new Error("TODO: Implement OpenAI to Chat message mapping")
    }
}
```

Refer to [Configure your environment](https://firebase.google.com/docs/functions/config-env) article for more
information on setting environment and secret variables for your functions.

### Command dispatcher configuration
The requests to front-facing functions return to user as fast as possible after changing the chat state in Firestore.
As soon as the AI run could take a considerable time, we run theme in a Cloud Task "offline" from the client request.
To execute the Assistant run we use the second class from the library - the [OpenAiChatWorker](src/aichat/OpenAiChatWorker.ts).
To create it, use the [AiChat](src/index.ts) factory we created as described in the [main documentation](https://github.com/motorro/firebase-ai-chat).

To register the Cloud Task handler you may want to create the following function:

```typescript
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import OpenAI from "openai";
import {OpenAiWrapper, Meta} from "@motorro/firebase-ai-chat-openai";

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
      // Create and run a worker
      // See the `dispatchers` definitions below
      await chatFactory.worker(new OpenAI({apiKey: openAiApiKey.value()}), dispatchers, myMessageMapper).dispatch(
          req,
          (chatDocumentPath: string, meta: Meta) => {
             // Optional task completion handler
             // Meta - some meta-data passed to chat operation
          }   
      );
    }
);
```
The `OpenAiChatWorker` handles the [OpenAiChatCommand](src/aichat/data/OpenAiChatCommand.ts) and updates [OpenAiChatState](src/index.ts)
with the results.

Full example is available in the [sample Firebase project](https://github.com/motorro/firebase-openai-chat-project/blob/master/Firebase/functions/src/openai/openai.ts).

