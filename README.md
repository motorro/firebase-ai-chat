# Firebase OpenAI chat

OpenAI assistant chat for front-end applications residing on server.

- Posts messages with callable functions
- Runs OpenAI assistant with Google Cloud Tasks
- Maintains chat state and messages in Firestore
- Function calls support

## Components


## Monorepo problem
Due to strict [type-check restrictions](https://github.com/googleapis/nodejs-firestore/issues/760) for 
firebase types the test example project is in the separate [repository](https://github.com/motorro/firebase-openai-chat-project)
