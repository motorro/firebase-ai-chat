# Firebase OpenAI chat
[OpenAI assistant](https://platform.openai.com/docs/assistants/overview) chat for front-end applications residing on server with [Firebase technology](https://firebase.google.com/).

## A problem statement
Since OpenAI has published its API, integrating custom ChatGPT to your client apps has become a rather easy option.
Given that the API is HTTP-based and there are also many [wrapping libraries](https://github.com/aallam/openai-kotlin) 
for any platform, the one might implement the chat directly in a mobile app or a web-site. However, it might be not 
a good architectural decision to go this way. Among the reasons are:

- OpenAI API key protection and management - if used on a front-end app the key leaks.
- Tools and function call code (a part of business logic) are exposed to app client.
- The latency in mobile application updates will limit your domain updates as function tool-calls reside on the 
  front-end.
- Mobile app connectivity is always a problem and given that an AI run takes a considerable time to execute the user 
  experience might not be optimal.

Thus, it might be a good idea to put the OpenAI interaction to the back-end and to update your client with just 
the results of AI runs.
The possible flow might be the following:
![Usecase diagram](http://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/motorro/firebase-openai-chat/master/readme/usecase.puml)

- User interacts with a front-end application and posts messages.
- The App uses YOUR backend endpoints to receive the user gestures.
- The Back-end executes the Assistant run in a worker function and posts the results to a local database.
- OpenAI tool calls are managed by your Back-end providing all necessary data back and forth.
- Upon the run is complete, Back-end updates its storage with AI replies.
- The App updates itself from the Back-end storage and displays changes to the User.

This project is an illustration of above-mentioned approach using:

- [Firebase Cloud functions](https://firebase.google.com/docs/functions) as a backend.
- [Google Cloud tasks](https://cloud.google.com/tasks) as an "offline" worker to run AI.
- [Firebase Cloud Firestore](https://firebase.google.com/docs/firestore) as a storage.

The project is packed as an NPM module in case you'd like to use it in your own application. It handles the complete
AI chat workflow including running OpenAI, message management, state management, and function runs.

## Sample Firebase project
Due to strict [type-check restrictions](https://github.com/googleapis/nodejs-firestore/issues/760) for
firebase types the test example project is in the separate [repository](https://github.com/motorro/firebase-openai-chat-project).
The sample includes:
- A minimal Firebase project
- A sample OpenAI assistant creation script
- A sample mobile application

## Components

![Component diagram](http://www.plantuml.com/plantuml/proxy?src=https://raw.githubusercontent.com/motorro/firebase-openai-chat/master/readme/components.puml)

- Client creates a chat by calling a cloud function
- Client posts messages to assistant with a client function
- Firebase launches a Cloud Task to run OpenAI assistant
- Client messages and Assistant response are written to Firestore
- Client gets chat state and messages by subscribing to Firestore documents 

## Sample Firebase project
Due to strict [type-check restrictions](https://github.com/googleapis/nodejs-firestore/issues/760) for 
firebase types the test example project is in the separate [repository](https://github.com/motorro/firebase-openai-chat-project)

## Module API
Use the following components to build the chat in your firebase project

### AssistantChat
[AssistantChat](src/aichat/AssistantChat.ts) is a front-facing API that takes requests from your clients.
It has three methods:

- `create` - creates a new chat
- `postMessage` - posts a new client message
- `closeChat` - finishes the chat deleting all resources
