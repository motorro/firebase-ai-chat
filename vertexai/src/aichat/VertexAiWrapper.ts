import {
    ChatData,
    ChatError,
    Continuation,
    DispatchError, isStructuredMessage, NewMessage,
    printAiExample,
    tagLogger,
    ToolCallRequest,
    ToolCallsResult
} from "@motorro/firebase-ai-chat-core";
import {ChatSession, Content, GenerativeModel, Part, StartChatParams} from "@google-cloud/vertexai";
import {FunctionCallPart, GenerateContentCandidate} from "@google-cloud/vertexai/src/types/content";
import {VertexAiSystemInstructions} from "./data/VertexAiSystemInstructions";
import {firestore} from "firebase-admin";
import {Thread} from "./data/Thread";
import {AiWrapper, PostMessageResult} from "./AiWrapper";
import {ChatThreadMessage, ThreadMessage} from "./data/ThreadMessage";
import {RunContinuationRequest} from "./data/RunResponse";
import CollectionReference = firestore.CollectionReference;
import Timestamp = firestore.Timestamp;
import {DefaultMessageMapper, VertexAiMessageMapper} from "./VertexAiMessageMapper";

const logger = tagLogger("VertexAiWrapper");

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
    private readonly debugAi: boolean;
    private readonly messageMapper: VertexAiMessageMapper;

    /**
     * Constructor
     * @param model Pre-configured `GenerativeModel`
     * @param firestore Firebase firestore
     * @param threadsPath Threads collection path
     * @param debugAi If true - will log AI request and response
     * @param messageMapper Maps messages from/to AI
     */
    constructor(
        model: GenerativeModel,
        firestore: FirebaseFirestore.Firestore,
        threadsPath: string,
        debugAi = false,
        messageMapper: VertexAiMessageMapper = DefaultMessageMapper
    ) {
        this.model = model;
        this.firestore = firestore;
        this.threads = firestore.collection(threadsPath) as CollectionReference<Thread>;
        this.debugAi = debugAi;
        this.messageMapper = messageMapper;
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
     * Sometimes Gemini creates a call with faulty data:
     * '{"functionCall":{"args":{"value":25}}}'
     * @param part Part to check
     * @return True if part is a function call
     * @private
     */
    private static checkFunctionCall(part: FunctionCallPart): DispatchError | undefined {
        if (undefined === part.functionCall.name) {
            logger.w("Function call error: no function name in call:", JSON.stringify(part));
            return {error: "You didn't supply a function name. Check tools definition and supply a function name!"};
        }
        return undefined;
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
        messages: ReadonlyArray<NewMessage>,
        dataSoFar: DATA,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>
    ): Promise<Continuation<PostMessageResult<DATA>>> {
        logger.d("Posting messages...");
        return await this.doPost(
            threadId,
            instructions,
            messages.map((it) => this.messageMapper.toAi(it)).flat(),
            dataSoFar,
            dispatch
        );
    }

    /**
     * Maintains conversation data
     * @param threadId Thread ID
     * @param instructions Instructions
     * @param parts Parts to post
     * @param dataSoFar Data so far
     * @param dispatch Dispatch function
     * @return Post result
     * @private
     */
    private async doPost<DATA extends ChatData>(
        threadId: string,
        instructions: VertexAiSystemInstructions<DATA>,
        parts: Array<Part>,
        dataSoFar: DATA,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>
    ): Promise<Continuation<PostMessageResult<DATA>>> {
        const tools = instructions.tools;
        const params: StartChatParams = {
            systemInstruction: VertexAiWrapper.generateSystemInstructions(instructions),
            ...(undefined !== tools ? {tools: tools.definition} : {}),
            history: (await this.getThreadMessages(threadId)).map((it) => it[1].content)
        };
        const chat = this.model.startChat(params);

        const result = await this.run(
            chat,
            parts,
            {data: dataSoFar, messages: []},
            dispatch
        );

        const {data: stateData, messages: stateMessages} = result.state;

        const resultMessages: Array<ChatThreadMessage> = [];
        const batch = this.firestore.batch();
        stateMessages.forEach((threadMessage) => {
            const mDoc = this.getThreadMessageCollection(threadId).doc();
            batch.set(mDoc, threadMessage);

            if ("model" === threadMessage.content.role) {
                const mapped = this.messageMapper.fromAi(threadMessage.content);
                if (mapped) {
                    resultMessages.push({
                        id: mDoc.id,
                        createdAt: threadMessage.createdAt,
                        author: "ai",
                        ...(isStructuredMessage(mapped) ? mapped : {text: String(mapped)})
                    });
                }
            }
        });

        await batch.commit();

        if (false === result.suspended) {
            return Continuation.resolve({
                data: stateData,
                messages: resultMessages
            });
        }

        return Continuation.suspend();
    }

    processToolsResponse<DATA extends ChatData>(
        threadId: string,
        instructions: VertexAiSystemInstructions<DATA>,
        request: RunContinuationRequest<DATA>,
        dataSoFar: DATA,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>
    ): Promise<Continuation<PostMessageResult<DATA>>> {
        return this.doPost(
            threadId,
            instructions,
            request.toolsResult.map((it) => ({
                functionResponse: {
                    name: it.toolName,
                    response: it.response
                }
            })),
            dataSoFar,
            dispatch,
        );
    }

    /**
     * Runs AI
     * @param chat Chat session
     * @param parts Parts to provide
     * @param soFar Data so far
     * @param dispatch Dispatching function
     * @return Inter-run session state
     * @private
     */
    private async run<DATA extends ChatData>(
        chat: ChatSession,
        parts: Array<Part>,
        soFar: InterPostState<DATA>,
        dispatch: (data: DATA, toolCalls: ReadonlyArray<ToolCallRequest>) => Promise<Continuation<ToolCallsResult<DATA>>>
    ): Promise<{ suspended: boolean, state: InterPostState<DATA>}> {
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

        /**
         * Runs tools
         * @param toolCalls Tool calls
         * @return Next state
         */
        const runTools = async (toolCalls: Array<FunctionCallPart>): Promise<{ suspended: boolean, state: InterPostState<DATA>}> => {
            if (0 === toolCalls.length) {
                return {suspended: false, state: {data: data, messages: messages}};
            }

            logger.d("Dispatching tools...");

            // Gemini misses function names from time to time
            let nameErrorIn = -1;
            let nameError: DispatchError | undefined = undefined;
            for (let i = 0; i < toolCalls.length; ++i) {
                if (nameErrorIn < 0) {
                    const checkError = VertexAiWrapper.checkFunctionCall(toolCalls[i]);
                    if (undefined !== checkError) {
                        nameErrorIn = i;
                        nameError = checkError;
                    }
                    break;
                }
            }
            if (nameErrorIn >= 0 && undefined !== nameError) {
                logger.w(`Empty function name in part ${nameErrorIn}`);
                const thisError = nameError;
                const otherError = {
                    error: `Function call was not done because you didn't provide a function name in part with index ${nameErrorIn}!`
                };
                return await this.run(
                    chat,
                    toolCalls.map((it, index) => ({
                        functionResponse: {
                            name: it.functionCall.name || "function name was not provided",
                            response: index === nameErrorIn ? thisError : otherError
                        }
                    })),
                    {data: data, messages: messages},
                    dispatch
                );
            }

            const result: Continuation<ToolCallsResult<DATA>> = await dispatch(
                data,
                toolCalls.map((part) => ({
                    toolCallId: part.functionCall.name,
                    toolName: part.functionCall.name,
                    soFar: data,
                    args: <Record<string, unknown>>part.functionCall.args
                }))
            );
            if (result.isResolved()) {
                logger.d("All tools dispatched");
                data = result.value.data;
                return await this.run(
                    chat,
                    result.value.responses.map((it) => ({
                        functionResponse: {
                            name: it.toolName,
                            response: it.response
                        }
                    })),
                    {data: result.value.data, messages: messages},
                    dispatch
                );
            } else {
                logger.d("Some tools suspended...");
                return {suspended: true, state: {data: data, messages: messages}};
            }
        };

        let aiResult: GenerateContentCandidate | undefined = undefined;
        if (this.debugAi) {
            tagLogger("AI").d("About to send parts to AI. Parts:", JSON.stringify(parts));
        }
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

        if (this.debugAi) {
            tagLogger("AI").d("Response from AI. Parts:", JSON.stringify(aiResult.content.parts));
        }
        messages.push({
            content: aiResult.content,
            createdAt: Timestamp.now(),
            inBatchSortIndex: ++nextBatchSortIndex
        });

        const functionCalls = aiResult.content.parts.filter(VertexAiWrapper.isFunctionCall);
        if (0 !== functionCalls.length) {
            return runTools(functionCalls);
        }

        return {suspended: false, state: {data: data, messages: messages}};
    }

    async deleteThread(threadId: string): Promise<void> {
        await this.firestore.recursiveDelete(this.threads.doc(threadId));
    }
}
