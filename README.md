![Firebase AI Chat](/readme/Github%20social.png)

[![Check](https://github.com/motorro/firebase-ai-chat/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/motorro/firebase-ai-chat/actions/workflows/test.yml)

Engines:
- Core: [![npm version](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-core.svg)](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-core)
- OpenAI: [![npm version](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-openai.svg)](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-openai)
- VertexAI: [![npm version](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-vertexai.svg)](https://badge.fury.io/js/@motorro%2Ffirebase-ai-chat-vertexai)


AI assistant chat for front-end applications residing on server with [Firebase technology](https://firebase.google.com/).
Supported AI engines:
- [OpenAI](https://platform.openai.com/docs/assistants/overview)
- [VertexAI](https://cloud.google.com/nodejs/docs/reference/vertexai/latest)


## Contents

<!-- toc -->

- [A problem statement](#a-problem-statement)
- [Sample Firebase project](#sample-firebase-project)
- [Components](#components)
- [Module API](#module-api)
  * [Scaffolds](#scaffolds)
  * [Firestore indexes](#firestore-indexes)
  * [Checking user authentication](#checking-user-authentication)
  * [Front-facing functions](#front-facing-functions)
  * [Creating AssistantChat](#creating-assistantchat)
  * [Creating a new chat](#creating-a-new-chat)
  * [Handling user messages](#handling-user-messages)
  * [Running AI](#running-ai)
  * [Using AI function tools](#using-ai-function-tools)
- [Tool continuation](#tool-continuation)
  * [Note on suspending the engine in tool calls with continuation](#note-on-suspending-the-engine-in-tool-calls-with-continuation)
- [AI message mapping](#ai-message-mapping)
- [Message middleware](#message-middleware)
- [Assistant switching and assistant crew](#assistant-switching-and-assistant-crew)
  * [Switching in method middleware](#switching-in-method-middleware)
  * [Switching in tools reducers](#switching-in-tools-reducers)
- [Using multiple engines in a single project](#using-multiple-engines-in-a-single)
- [Client application](#client-application)

<!-- tocstop -->

## A problem statement
Since companies like OpenAI has published its API, integrating custom chats to your client apps has become a rather easy option.
Given that the API is HTTP-based and there are also many [wrapping libraries](https://github.com/aallam/openai-kotlin) 
for any platform, the one might implement the chat directly in a mobile app or a web-site. However, it might be not 
a good architectural decision to go this way. Among the reasons are:

- AI API key protection and management - if used on a front-end app the key leaks.
- Tools and function call code (a part of business logic) are exposed to app client.
- The latency in mobile application updates will limit your domain updates as function tool-calls reside on the 
  front-end.
- Mobile app connectivity is always a problem and given that an AI run takes a considerable time to execute the user 
  experience might not be optimal.

Thus, it might be a good idea to put the AI interaction to the back-end and to update your client with just 
the results of AI runs.
The possible flow might be the following:
![Usecase diagram](http://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/motorro/firebase-openai-chat/master/readme/usecase.puml)

- User interacts with a front-end application and posts messages.
- The App uses YOUR backend endpoints to receive the user gestures.
- The Back-end executes the Assistant run in a worker function and posts the results to a local database.
- Function tool calls are managed by your Back-end providing all necessary data back and forth.
- Upon the run is complete, Back-end updates its storage with AI replies.
- The App updates itself from the Back-end storage and displays changes to the User.

This project is an illustration of above-mentioned approach using:

- [Firebase Cloud functions](https://firebase.google.com/docs/functions) as a backend.
- [Google Cloud tasks](https://cloud.google.com/tasks) as an "offline" worker to run AI.
- [Firebase Cloud Firestore](https://firebase.google.com/docs/firestore) as a storage.
- [Firebse Authentication](https://firebase.google.com/docs/auth) to authenticate users and restrict the chat access.

The project is packed as an NPM module in case you'd like to use it in your own application. It handles the complete
AI chat workflow including running AI engine, message management, state management, and function runs.

## Sample Firebase project
Due to strict [type-check restrictions](https://github.com/googleapis/nodejs-firestore/issues/760) for
firebase types the test example project is in the separate [repository](https://github.com/motorro/firebase-ai-chat-project).
The sample includes:
- A minimal Firebase project
- A sample OpenAI assistant creation script
- A sample Gemini assistant creation script
- A sample mobile application

## Components
Let's take a closer look at the implementation...

![Component diagram](http://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/motorro/firebase-ai-chat/master/readme/components.puml)

- Client creates a chat by calling a cloud function.
- Client posts messages to assistant with a client function.
- Firebase launches a Cloud Task to run OpenAI assistant.
- Client messages and Assistant response are written to Firestore.
- Client gets chat state and messages by subscribing to Firestore documents.

## Module API
The module has three classes to use in your project:
- [AssistantChat](core/src/aichat/AssistantChat.ts) - handles requests from the App user
- [AiChatWorker](core/src/aichat/workers/ChatWorker.ts) - runs the OpenAI interaction "off-line" in a Cloud function
- [AiChat](openai/src/index.ts) - a factory to create those above

### Scaffolds

To install OpenAI module use:
```shell
npm i --save @motorro/firebase-ai-chat-openai
```
To install VertexAI module use:
```shell
npm i --save @motorro/firebase-ai-chat-vertexai
```

The full example `index.ts` for your Firebase Cloud Functions project is available [here](https://github.com/motorro/firebase-openai-chat-project/blob/master/Firebase/functions/src/index.ts).
It demonstrates the technology and AI function tools usage. We will create a simple calculator that can add and subtract
numbers from the accumulated state value that is being persisted along with a chat state.
For our test project we will use the following state:
```typescript
export interface CalculateChatData extends ChatData{
  readonly sum: number
}
```

First things first we need to create:
- A Firestore collection to hold chats. The collection documents hold the chat state and have
  a "messages" sub-collection where the chat messages are stored.
- An instance of chat components factory that are to be used to run chats.

```typescript
import {AiChat, factory} from "@motorro/firebase-ai-chat-openai";

// Chats collection name
const CHATS = "chats"; 

const db = firestore();
const chats = db.collection(CHATS) as CollectionReference<ChatState<CalculateChatData>>;
const chatFactory: AiChat = factory(firestore(), getFunctions(), "europe-west1");
```

You may also want to set a custom logger to the library so the log output will get to your functions log:

```typescript
import {logger as fLogger} from "firebase-functions/v2";
import {Logger, setLogger} from "firebase-ai-chat";

// Chat processor name
const NAME = "calculator";

const logger: Logger = {
  d: (...args: unknown[]) => {
    fLogger.debug([NAME, ...args]);
  },
  i: (...args: unknown[]) => {
    fLogger.info([NAME, ...args]);
  },
  w: (...args: unknown[]) => {
    fLogger.warn([NAME, ...args]);
  },
  e: (...args: unknown[]) => {
    fLogger.error([NAME, ...args]);
  }
};
setLogger(logger);
```

All chats are bound to users authenticated with Firebase Auth. For the client App to be able to get chat snapshots,
you need to adjust your [Firestore rules](https://firebase.google.com/docs/firestore/security/get-started):

```cel
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Check the user is authenticated
    function isAuthenticated() {
        return null != request.auth && null != request.auth.uid;
    }

    // Check the user owns the document
    // Include filter `where("userId", "==", auth.uid)` to your list requests
    function isOwner() {
      return request.auth.uid == resource.data.userId;
    }

	match /chats/{chat} {
      // Allow read to those who created the chat
      allow read: if isAuthenticated() && isOwner();
      allow write: if false;

      // Allow reading messages to chat owners
      match /messages/{message} {
        allow read: if isAuthenticated() && isOwner();
        allow write: if false;
      }
    }
  }
}
```

### Firestore indexes
To be able to run the code Firebase needs two special indexes to sort chat documents and messages.
You can get the latest indexes versions [here](firestore.indexes.json).

### Checking user authentication
As soon as we want all users to be authenticated to access the functions, let's create a template function to handle 
all function requests. We will later use this function to wrap all client-facing handlers:

```typescript
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";

async function ensureAuth<DATA, RES>(request: CallableRequest<DATA>, block: (uid: string, data: DATA) => Promise<RES>): Promise<RES> {
  const uid = request.auth?.uid;
  if (undefined === uid) {
    logger.w("Unauthenticated");
    return Promise.reject<RES>(new HttpsError("unauthenticated", "Unauthenticated"));
  }
  return await block(uid, request.data);
}
```
### Front-facing functions
All chat requests from users are handled by [AssistantChat](core/src/aichat/AssistantChat.ts).
It is a front-facing API that takes requests from your clients, maintains the chat state and schedules AI runs.
The class has three methods:

- `create` - creates a new interactive chat with your app client. 
- `singleRun` - creates a new chat that runs once. You may find it to schedule one-off analyses with tools output.
- `postMessage` - posts a new client message
- `closeChat` - finishes the chat deleting all resources (optional)

### Creating AssistantChat
To create request processor, use the [AiChat](openai/src/index.ts) factory we have set up in the previous step:

```typescript
// Functions region where the worker task will run
const region = "europe-west1";
// Chat worker function (queue) name to dispatch work
const NAME = "calculator";

const assistantChat = chatFactory.chat(
    NAME
);
```

### Creating a new chat

First things first we need to create:
- A Firestore collection to hold chats. The collection documents hold the chat state and have 
  a "messages" sub-collection where the chat messages are stored.
- An instance of chat components factory that are to be 

Imagine the chat in the App as a sequence of two screens:

- Initial prompt from the User, where he enters the first request to AI
- The chat screen where he observes the messages and the chat state

Then to start a chat we may need the following request to your cloud function:

```typescript
export interface CalculateChatRequest {
    readonly message: string
}
```

In response to our requests the client will get:
```typescript
export interface CalculateChatResponse {
  // Created chat document
  readonly chatDocument: string
  // Chat status
  readonly status: ChatStatus,
  // Chat data so far
  readonly data: CalculateChatData
}
```

To handle this request at Firebase you may want to create the following function:

```typescript
import {CallableOptions, CallableRequest, onCall as onCall2} from "firebase-functions/v2/https";
import { ChatState } from "firebase-ai-chat";

export const calculate = onCall2(options, async (request: CallableRequest<CalculateChatRequest>) => {
  return ensureAuth(request, async (uid, data) => {
    // Create a new chat document reference
    const chat = chats.doc() as DocumentReference<ChatState<CalculateChatData>>;
    // Configure AI assistant
    const config: OpenAiAssistantConfig = {
      engine: "openai",
      assistantId: openAiAssistantId.value(),
      dispatcherId: NAME
    };
    // Create a chat document record in CHATS collection
    const result = await assistantChat.create(
            chat, // Chat document
            uid, // Owner ID
            {sum: 0}, // Initial data state
            config, // Configuration
            [data.messages], // Initial message to process
            {a: 1}, // Optional metadata to pass with worker task. Available in completion handler
            {
              aiMessageMeta: { // This meta will be added to all AI messages (optional)
                  name: "AI"
              },
              userMessageMeta: { // This meta will be added to all User messages (optional)
                  name: "Vasya"
              }
            }
    );
    
    // Return the `CalculateChatResponse` to client App
    return {
      chatDocument: chat.path, // Created chat document path
      status: result.status, // Chat status so far (see `ChatStatus`)
      data: result.data
    };
  });
});
```

Under the hood the processor will:
- Create a [ChatState](core/src/aichat/data/ChatState.ts) document in `CHATS` collection.
- Store a `CalculateChatData` of initial data there.
- Create a [ChatMessage](core/src/aichat/data/ChatMessage.ts) in `messages` sub-collection of chat document.
- Run a Cloud Task by queueing a [ChatCommand](core/src/aichat/data/ChatCommand.ts) to Cloud Tasks.

### Handling user messages
User may respond to AI messages whenever the [ChatState](core/src/aichat/data/ChatState.ts) has one of the 
permitted [ChatStatus](core/src/aichat/data/ChatState.ts):
- `userInput` - waiting for a user input

The request to handle a message may look like this:

```typescript
export interface PostCalculateRequest {
    readonly chatDocument: string
    readonly message: string
}
```

To handle such a request you may want to create the following function:

```typescript
export const postToCalculate = onCall2(options, async (request: CallableRequest<PostCalculateRequest>) => {
  return ensureAuth(request, async (uid, data) => {
    // Creates a new client message and schedules an AI run
    const result = await assistantChat.postMessage(
            db.doc(data.chatDocument) as DocumentReference<ChatState<CalculateChatData>>,
            uid,
            [data.message],
            {a: 1} // Optional metadata to pass with worker task. Available in completion handler
    );
    
    // Return the `CalculateChatResponse` to client App
    return {
      chatDocument: data.chatDocument,
      status: result.status,
      data: result.data
    };
  });
});
```

### Running AI
The requests to front-facing functions return to user as fast as possible after changing the chat state in Firestore.
As soon as the AI run could take a considerable time, we run theme in a Cloud Task "offline" from the client request.
To execute the Assistant run we use the second class from the library - the [ChatWorker](core/src/aichat/workers/ChatWorker.ts).
To create it, use the [AiChat](openai/src/index.ts) factory we created in previous steps.

To register the Cloud Task handler you may want to create the following function:

```typescript
import {onTaskDispatched} from "firebase-functions/v2/tasks";
import OpenAI from "openai";
import {VertexAiWrapper, Meta} from "@motorro/firebase-ai-chat-openai";

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
The `VertexAiChatWorker` handles the [ChatCommand](core/src/aichat/data/ChatCommand.ts) and updates [ChatState](core/src/aichat/data/ChatState.ts)
with the results.
The client App will later get the results of the run by subscribing the Firebase collection snapshots flow.

Worth mentioning is that if you run several chats with a different state for different purposes you may need only one 
worker function to handle all the tasks. The [ChatCommand](core/src/aichat/data/ChatCommand.ts) has all the required reference
data to address the correct chat document and chat data state.

As the AI run may involve several OpenAI calls which may fail at any intermediate call the possible retry run strategy 
seems unclear at the moment. That is why the worker will set the `failed` state to chat on any error. If you want to 
restore the thread somehow - create the new chat and copy your messages manually.

### Using AI function tools
OpenAI Assistant and Chat completion API has a powerful feature called [Function calling](https://platform.openai.com/docs/assistants/tools/function-calling).
The use of functions is a bridge between your business logic and the AI. It may be used to retrieve some information
from your domain, to alter some state that resides on your server or to limit the AI "hallucinations" when operating
with your domain data.

In this example we create a simple calculator that can add and subtract numbers from some accumulated value stored 
along with your chat state. Here is our domain state:

```typescript
export interface CalculateChatData extends ChatData{
  readonly sum: number
}
```

In the sample project you can find the script to create a [sample assistant](https://github.com/motorro/firebase-openai-chat-project/blob/master/Firebase/assistant/src/createCalculatorAssistant.ts)
to be a calculator. Take a look at the prompt and function definitions there for an example.

The library supports function tool calling by providing a map of function dispatchers to `VertexAiChatWorker`.
The [dispatcher](core/src/aichat/ToolsDispatcher.ts) is the following function:

```typescript
export interface ToolsDispatcher<DATA extends ChatData> {
  (data: DATA, name: string, args: Record<string, unknown>, continuation: ContinuationCommand<unknown>, chatData: ChatDispatchData): ToolDispatcherReturnValue<DATA>
}
```
The parameters are the following:

- `data` - Chat state data so far
- `name` - Name of function called
- `args` - Function arguments
- `continuation` - Continuation command (see below)
- `chatData` - Common chat data

The function returns [ToolDispatcherReturnValue](core/src/aichat/ToolsDispatcher.ts) value which may be:

- Some data - it will be submitted to AI as `{result: "Response from your tool"}`
- Reduction result of `data` state passed to dispatcher. Return `{data: "Your data state"}` from the dispatcher and it 
  will go to AI like this
- Some error describing the problem to AI: `{error: "You have passed the wrong argument}`
- Continuation of above (see continuation below)
- Promise of the above

The [AiWrapper](openai/src/aichat/AiWrapper.ts) will run your dispatcher and re-run the Assistant with
dispatcher output.

For our simple project we define the dispatcher like this:

```typescript
import {ToolsDispatcher} from "@motorro/firebase-ai-chat-openai";

const dispatcher: ToolsDispatcher<CalculateChatData> = async function(
        data: DATA, // Chat data so far
        name: string, // Function name
        args: Record<string, unknown>, // Function arguments
        continuation: ContinuationCommand<unknown>, // Continuation in case of suspension. See below
        chatData: ChatDispatchData<CM>, // Chat data
        handOver: ToolsHandOver<WM, CM> // Chat hand-over to another assistant. See below
): ToolDispatcherReturnValue<CalculateChatData> {
  switch (name) {
    case "getSum":
      logger.d("Getting current state...");
      return {
        sum: data.sum
      };
    case "add":
      logger.d("Adding: ", args);
      return {
        sum: data.sum + (args.value as number)
      };
    case "subtract":
      logger.d("Handing-over subtract: ", args.value);
      handOver.handOver(
              {
                config: {
                  engine: "vertexai",
                  instructionsId: SUBTRACTOR_NAME
                },
                messages: [
                  `User wants to subtract ${args.value as number}`
                ],
                chatMeta: {
                  aiMessageMeta: {
                    name: SUBTRACTOR_NAME,
                    engine: "VertexAi"
                  }
                }
              }
      );
      return {
        result: "The request was passed to Divider. The number is being subtracted. Divider will come back with a new accumulated state"
      };
    case "multiply":
      logger.d("Multiply. Suspending multiplication: ", args.value);
      await taskScheduler.schedule(
              multiplierQueueName,
              {
                data: data,
                factor: (args.value as number),
                continuationCommand: continuation
              }
      );
      return Continuation.suspend();
    default:
      logger.e("Unimplemented function call: ", name, args);
      throw new HttpsError("unimplemented", "Unimplemented function call");
  }
};

const dispatchers: Record<string, ToolsDispatcher<any>> = {
  [NAME]: dispatcher
};
```

We pass the dispatchers object to our worker. As mentioned before the single Cloud Task function with a worker
is enough to handle all AI runs from different chats. That is why we pass a map of dispatchers here. The worker selects
a correct dispatcher getting a command and reading the appropriate chat state from Firebase.

## Tool continuation
Sometimes your dispatcher can't get a response promptly (within the dispatch promise). For example, you may need to launch
another queue task to get the response. The dispatching function receives the `continuation` parameter. If you need to 
suspend tool processing, save this continuation somewhere and when your response is ready, use [ToolsContinuationScheduler](core/src/aichat/workers/ToolsContinuationScheduler.ts)
which you could get from the factory to respawn the tools processing:

```typescript
const taskScheduler = taskScheduler || new FirebaseQueueTaskScheduler(functions, location);
const continuationSchedulerFactory = toolContinuationSchedulerFactory(firestore, taskScheduler);

// Create the instance of continuation scheduler for our queue name
const continuationScheduler: ToolsContinuationScheduler<string> = continuationSchedulerFactory.getContinuationScheduler("calculator");

let savedContinuation: ContinuationCommand<unknown> | undefined = undefined;

const myDispatcher = (data: ChatData, name: string, args: Record<string, unknown>, continuation: ContinuationCommand<unknown>) => {
  // Getting the result requires some data not available promptly
  // Save passed continuation elswhere
  savedContinuation = continuation;
  // Run your offline tool
  // ...
  // Suspend tool processing
  return Continuation.suspend();
}

// Later when result is ready
const whenResultIsReady = async (data: string) => {
  // Resume tools processing using saved continuation
  const continuation = savedContinuation;
  if (undefined !== continuation) {
      await continuationScheduler.continue(continuation, {result: {answer: data}});
  }
}
```
Example of suspending tool dispatch in tools reducer could be found [here](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/common/calculator.ts#L42).
Example of resuming AI run could be found [here](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/index.ts#L136).

### Note on suspending the engine in tool calls with continuation
Take a note that suspending the assistant within tool suspending the calls with continuation may fail if the new assistant
takes a long time to hand back. For example, currently (2024-06-28), OpenAI calls tools during the assistant run and times
out after 10 minutes.

## AI message mapping
By default, the library takes text messages from AI and makes text chat messages of them. If you use images or want to 
parse custom data (or metadata) when exchanging messages between the client chat and AI you may want to add a custom 
message mapper for each engine. Take a look at default mappers to get the idea:
- [OpenAI](openai/src/aichat/OpenAiMessageMapper.ts)
- [VertexAI](vertexai/src/aichat/VertexAiMessageMapper.ts)

The [NewMessage](core/src/aichat/data/NewMessage.ts) which goes to/from client and AI may be just a string of a structured
data that gets to corresponding fields of [ChatMessage](core/src/aichat/data/ChatMessage.ts).
To provide your custom message mapper use the corresponding parameter to the `worker` functions of chat factories.
The example is available in a sample project:
- [OpenAI](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/openai/openai.ts#L89)
- [VertexAI](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/openai/openai.ts#L89)
- [Common part](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/common/calculator.ts#L196)

## Message middleware
By default, the library saves all messages received from AI to the client chat. However, you may want to custom-process
those messages to filter special messages or to do some other processing (e.g. [handing over](#assistant-swithching-and-assistant-crew)).
The middleware is a function with the following parameters:
```typescript
export interface MessageMiddleware<DATA extends ChatData, CM extends ChatMeta = ChatMeta> {
  /**
   * Processes message
   * @param messages Message received from AI
   * @param chatDocumentPath Chat document path
   * @param chatState Chat state
   * @param control Message processing control
   */
  (
      messages: ReadonlyArray<NewMessage>,
      chatDocumentPath: string,
      chatState: ChatState<AssistantConfig, DATA, CM>,
      control: MessageProcessingControl<DATA, CM>
  ): Promise<void>
}
```
Each time the engine responds with a message, it is being mapped with a mapper and then provided to your middleware along
with the chat document path and state. Along with the data you get a [MessageProcessingControl](core/src/aichat/middleware/MessageMiddleware.ts)
object to take the next steps. You can custom-process messages, pass them to the next processor or schedule some other
task and complete the processing queue. Take a look at the source code for documentation. This is pretty "low-level" API
so some more specialized middleware is already there. Take a look at hand-over middleware below.
To provide the middleware to your workers, pass the array of them to the `worker` method of the engine factory.

## Assistant switching and assistant crew
As your tasks grow more complex it is worth considering delegating different tasks to different assistants each of them
trained to perform certain scope of tasks. Thus, a crew of assistants work as a team to decompose the task and move step
by step to fulfill it. One of the famous frameworks to build such a team is [Crew AI](https://docs.crewai.com/). This 
library also supports changing assistants on-demand. For example, consider our main Calculator who could add numbers. 
If user wants to subtract or to divide the accumulated value by some number we could switch chat context to another assistant
"trained" to divide numbers. Here is the example:
![Switching](/readme/Switching.png)

Here is how it is being done as a sequence diagram:
![Switching](http://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/motorro/firebase-ai-chat/master/readme/Switching.puml)

To be able to do it there are two methods in [AssistantChat](core/src/aichat/AssistantChat.ts):

- `handOver` - changes the context of chat to use with another assistant.
- `handBack` - restores context to main assistant

### Switching in method middleware
You may also switch during message processing. There is a special [middleware](core/src/aichat/middleware/handOverMiddleware.ts)
available to do the switch during the message processing. The `HandOverControl` object in your middleware function will get the
methods to hand over and to hand back the chat control.

The example is available in a sample project. 
1. Instruct the assistant to use some kind of [special message for hand-over](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/common/instructions.ts#L12).
2. Optionally, make a mapper to prepare a message. See above in [AI message mapping](#ai-message-mapping) section.
3. Set up a middleware [function](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/common/calculator.ts#L137).
4. Provide mappers and middleware to workers: [OpenAI](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/openai/openai.ts#L104), [VertexAI](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/vertexai/vertexai.ts#L124).

### Switching in tools reducers
Since core version 10 the library supports switching in tools reducers. You will get a [ToolsHandOver](core/src/aichat/ToolsDispatcher.ts#L70)
object to your reducer. Use it to request `handOver` and reply to AI with some message. The tool run will complete and when
you return back from the other assistant, add some summary messages to `handBack` to run the calling assistant again.
The example is available in a [sample project](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/common/calculator.ts#L53).

## Using multiple engines in a single project
You may mix several engines in a single project. For example, you may handle different tasks with different engines.
To be able to do it:
1. Import both engine libraries and (optionally) the core.
2. Create a common function to resolve chat command schedulers:
   ```typescript
   export const commandSchedulers = (queueName: string, taskScheduler: TaskScheduler): ReadonlyArray<CommandScheduler> => {
      return [
          ...openAiFactory(firestore(), getFunctions(), region, undefined, undefined, true, true).createDefaultCommandSchedulers(queueName, taskScheduler),
          ...vertexAiFactory(firestore(), getFunctions(), region, undefined, undefined, true, true).createDefaultCommandSchedulers(queueName, taskScheduler)
      ];
   };
   ```
3. Pass the function to the [chat factory function](openai/src/index.ts#L135) and to the [worker factory function](openai/src/index.ts#L171)
4. [ChatWorker](core/src/aichat/workers/ChatWorker.ts) returns `true` if it dispatches successfully and `false` if not.
   Use this value to iterate workers and [get the one](https://github.com/motorro/firebase-ai-chat-project/blob/master/Firebase/functions/src/index.ts#L137) supporting the command.

## Client application
The sample project includes a sample KMP [Android application](https://github.com/motorro/firebase-ai-chat-project/tree/master/Client)
The app uses:
- [firebase-kotlin-sdk](https://github.com/GitLiveApp/firebase-kotlin-sdk) - a cross-platform Firebase client library
- [CommonStateMachine](https://github.com/motorro/CommonStateMachine) - to run application logic
- [An article by Carlos Ugaz](https://medium.com/@carlosgub/how-to-implement-firebase-firestore-in-kotlin-multiplatform-mobile-with-compose-multiplatform-32b66cdba9f7) - how to set up and run a cross-platform firebase app 

The chat interface looks like this:
![Chat application](readme/app.png)

Here we have:

- A list of chat messages
- Current data state of the calculator

The app calls the functions described above to start/complete the chat and subscribes to Firestore collections to watch 
chat updates.

To listen to the chat state, [subscribe](https://github.com/motorro/firebase-ai-chat-project/blob/master/Client/composeApp/src/commonMain/kotlin/com/motorro/aichat/state/Chat.kt#L63) 
to the chat document provided by function response:
```kotlin
// Chat document from the server response
private val chatDocument: DocumentReference = Firebase.firestore.document(documentPath)

// Chat state
private data class ChatStateData(
  val status: ChatStatus,
  val data: CalculateChatData,
  val messages: List<Pair<String, ChatMessage>>
)

private var stateData: ChatStateData = ChatStateData(
  ChatStatus.created,
  CalculateChatData(0),
  emptyList()
)

private fun subscribeDocument() {
    chatDocument.snapshots
        .onEach { snapshot ->
            val data: ChatState = snapshot.data()
            stateData = stateData.copy(
                status = data.status,
                data = data.data
            )
            render()
        }
        .catch {
            Napier.e(it) { "Error subscribing to chat" }
            setMachineState(factory.chatError(it, chatDocument))
        }
        .launchIn(stateScope)
}
```

Every time our Cloud function updates the chat status, the client will get the status and data update.

To listen to the list of messages - [subscribe](https://github.com/motorro/firebase-ai-chat-project/blob/master/Client/composeApp/src/commonMain/kotlin/com/motorro/aichat/state/Chat.kt#L80) 
to messages sub-collection:

```kotlin
private fun subscribeMessages() {
    chatDocument.collection("messages")
        // Add a filter by owner user ID so Firestore security 
        // rules allow you to get the list
        .where { "userId".equalTo(userId) }
        // Add a sorting direction
        .orderBy("createdAt", Direction.ASCENDING)
        .snapshots
        .onEach { snapshots ->
            stateData = stateData.copy(
                messages = snapshots.documents.map { document ->
                    val data: ChatMessage = document.data()
                    Pair(document.id, data)
                }
            )
            render()
        }
        .catch {
            Napier.e(it) { "Error subscribing to chat messages" }
            setMachineState(factory.chatError(it, chatDocument.path))
        }
        .launchIn(stateScope)
}
```

Whenever the server creates a new message the app will display it.
