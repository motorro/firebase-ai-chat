import {
    ChatData,
    ChatError,
    DispatchResult,
    getDispatchError,
    logger,
    printAiExample,
    ToolsDispatcher
} from "@motorro/firebase-ai-chat-core";
import {ChatSession, Content, GenerativeModel, Part, StartChatParams} from "@google-cloud/vertexai";
import {
    FunctionCallPart,
    FunctionResponsePart,
    GenerateContentCandidate
} from "@google-cloud/vertexai/src/types/content";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";
import {firestore} from "firebase-admin";
import {Thread} from "./data/Thread";
import {AiWrapper, PostMessageResult} from "./AiWrapper";
import {ChatThreadMessage, ThreadMessage} from "./data/ThreadMessage";
import CollectionReference = firestore.CollectionReference;
import Timestamp = firestore.Timestamp;

/**
 * Inter AI call state
 */
type InterPostState<DATA extends ChatData> = Readonly<{data: DATA, messages: ReadonlyArray<ThreadMessage>}>;

/**
 * Wraps Open AI assistant use
 */
export class VertexAiWrapper implements AiWrapper {
    private readonly model: GenerativeModel;
    private readonly firestore: FirebaseFirestore.Firestore;
    private readonly threads: CollectionReference<Thread>;

    /**
     * Constructor
     * @param model Pre-configured `GenerativeModel`
     * @param firestore Firebase firestore
     * @param threadsPath Threads collection path
     */
    constructor(
        model: GenerativeModel,
        firestore: FirebaseFirestore.Firestore,
        threadsPath: string,
    ) {
        this.model = model;
        this.firestore = firestore;
        this.threads = firestore.collection(threadsPath) as CollectionReference<Thread>;
    }

    /**
     * Generates system instructions
     * @param config System instructions config
     * @return System instructions content
     */
    private static generateSystemInstructions<DATA extends ChatData>(config: VertexAiSystemInstructions<DATA>): Content {
        const parts: Array<Part> = [];
        parts.push({text: "Instructions: " + config.instructions});

        let exampleNumber = 1;
        config.examples?.forEach((it) => {
            parts.push({text: printAiExample(it, exampleNumber)});
            ++exampleNumber;
        });

        return {
            parts: parts,
            role: "system"
        };
    }

    private static isFunctionCall(part: Part): part is FunctionCallPart {
        return "functionCall" in part && undefined !== part.functionCall;
    }

    /**
     * Thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @return Message collection reference
     * @private
     */
    getThreadMessageCollection(threadId:string): CollectionReference<ThreadMessage> {
        return this.threads.doc(threadId).collection("history") as CollectionReference<ThreadMessage>;
    }

    /**
     * Returns thread messages
     * Visible for testing
     * @param threadId Thread ID
     * @private
     */
    async getThreadMessages(threadId: string): Promise<ReadonlyArray<[string, ThreadMessage]>> {
        return (await this.getThreadMessageCollection(threadId).orderBy("createdAt").orderBy("inBatchSortIndex").get()).docs.map((doc) => {
            return [doc.id, doc.data()];
        });
    }

    async createThread(meta: Readonly<Record<string, string>>): Promise<string> {
        logger.d("Creating thread. Meta:", JSON.stringify(meta));
        const doc = this.threads.doc();
        await doc.set({meta: meta});
        return doc.id;
    }

    async postMessage<DATA extends ChatData>(
        threadId: string,
        instructions: VertexAiSystemInstructions<DATA>,
        messages: ReadonlyArray<string>,
        dataSoFar: DATA
    ): Promise<PostMessageResult<DATA>> {
        const tools = instructions.tools;
        const params: StartChatParams = {
            systemInstruction: VertexAiWrapper.generateSystemInstructions(instructions),
            ...(undefined !== tools ? {tools: tools.definition} : {}),
            history: (await this.getThreadMessages(threadId)).map((it) => it[1].content)
        };
        const chat = this.model.startChat(params);

        const result = await this.doPostMessage(
            chat,
            messages.map((it) => ({
                text: it
            })),
            tools?.dispatcher || <ToolsDispatcher<DATA>>((data) => Promise.resolve(data)),
            {data: dataSoFar, messages: []}
        );

        const resultMessages: Array<ChatThreadMessage> = [];
        const batch = this.firestore.batch();
        result.messages.forEach((threadMessage) => {
            const mDoc = this.getThreadMessageCollection(threadId).doc();
            batch.set(mDoc, threadMessage);

            if ("model" === threadMessage.content.role) {
                let message: string | undefined = undefined;
                threadMessage.content.parts.forEach((part) => {
                    const text = part.text;
                    if (undefined !== text) {
                        message = (message && message + "\n" + text) || text;
                    }
                });
                if (undefined !== message) {
                    resultMessages.push({
                        id: mDoc.id,
                        createdAt: threadMessage.createdAt,
                        author: "ai",
                        text: message
                    });
                }
            }
        });

        await batch.commit();

        return {
            data: result.data,
            messages: resultMessages
        };
    }

    private async doPostMessage<DATA extends ChatData>(
        chat: ChatSession,
        parts: Array<Part>,
        dispatcher: ToolsDispatcher<DATA>,
        soFar: InterPostState<DATA>,
    ): Promise<InterPostState<DATA>> {
        let data = soFar.data;
        let nextBatchSortIndex = soFar.messages[soFar.messages.length - 1]?.inBatchSortIndex || 0;
        const messages: Array<ThreadMessage> = [
            ...soFar.messages,
            {
                content: {
                    role: "user",
                    parts: parts
                },
                createdAt: Timestamp.now(),
                inBatchSortIndex: ++nextBatchSortIndex
            }
        ];

        let aiResult: GenerateContentCandidate | undefined = undefined;
        try {
            aiResult = (await chat.sendMessage(parts)).response?.candidates?.at(0);
        } catch (e) {
            logger.w("AI call error", e);
            return Promise.reject(new ChatError("unavailable", false, "Error running AI", e));
        }
        if (undefined === aiResult) {
            logger.w("Empty AI result");
            return Promise.reject(new ChatError("unavailable", false, "No candidates in AI answer"));
        }

        messages.push({
            content: aiResult.content,
            createdAt: Timestamp.now(),
            inBatchSortIndex: ++nextBatchSortIndex
        });

        const functionResults: Array<FunctionResponsePart> = [];
        for (const part of aiResult.content.parts) {
            if (VertexAiWrapper.isFunctionCall(part)) {
                let dispatchResult: DispatchResult<DATA>;
                try {
                    data = await dispatcher(data, part.functionCall.name, <Record<string, unknown>>part.functionCall.args);
                    dispatchResult = {data: data};
                } catch (e: unknown) {
                    logger.w("Error dispatching function:", e);
                    dispatchResult = getDispatchError(e);
                }
                functionResults.push({
                    functionResponse: {
                        name: part.functionCall.name,
                        response: dispatchResult
                    }
                });
            }
        }

        if (0 !== functionResults.length) {
            return await this.doPostMessage(
                chat,
                functionResults,
                dispatcher,
                {data: data, messages: messages},
            );
        }

        return {data: data, messages: messages};
    }

    async deleteThread(threadId: string): Promise<void> {
        await this.firestore.recursiveDelete(this.threads.doc(threadId));
    }
}
