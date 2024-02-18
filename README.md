# Firebase OpenAI chat

** Under construction **

- Posts messages with callable functions
- Runs OpenAI assistant runs with Google Cloud Tasks
- Maintains chat state and messages in Firestore

## Monorepo problem
Due to strict [type-check restrictions](https://github.com/googleapis/nodejs-firestore/issues/760) for 
firebase types the test example project is in the separate [repository](https://github.com/motorro/firebase-openai-chat-project)