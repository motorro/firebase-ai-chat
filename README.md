# Firebase OpenAI chat

[OpenAI assistant](https://platform.openai.com/docs/assistants/overview) chat for front-end applications residing on server.

- Posts messages with callable functions
- Runs OpenAI assistant with Google Cloud Tasks
- Maintains chat state and messages in Firestore
- Function calls support
- Keeps your logic and OpenAI key secure

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
