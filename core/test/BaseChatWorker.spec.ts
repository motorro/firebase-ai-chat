import * as admin from "firebase-admin";
import {db, test} from "./functionsTest";

import {firestore} from "firebase-admin";
import {
    anything,
    instance,
    imock,
    reset,
    when,
    capture
} from "@johanblumenberg/ts-mockito";
import CollectionReference = admin.firestore.CollectionReference;
import {Data, threadId, chatState, data, userId, AiConfig, DispatchAction} from "./mock";
import Timestamp = admin.firestore.Timestamp;
import {
    ChatMessage,
    ChatState,
    ChatStatus,
    BaseChatWorker,
    TaskScheduler,
    Collections, Meta
} from "../src";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {ChatError} from "../lib/aichat/data/ChatError";
import {ChatCommandData} from "../src/aichat/data/ChatCommandQueue";
import {Dispatch, Run} from "../src/aichat/data/Dispatch";
import FieldValue = firestore.FieldValue;
import {ChatCommand} from "../src/aichat/TaskScheduler";
import {expect} from "chai";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Base chat worker", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<AiConfig, Data>>;
    const chatDoc = chats.doc();
    const chatMessages = chatDoc.collection(Collections.messages) as CollectionReference<ChatMessage>;
    const chatDispatches = chatDoc.collection(Collections.dispatches) as CollectionReference<Dispatch>;
    const dispatchId = "dispatchId";
    const runId = "runId";

    const context: TaskContext = {
        executionCount: 0,
        id: runId,
        queueName: "Chat",
        retryCount: 0,
        scheduledTime: ""
    };

    const meta: Meta = {
        a: 1
    };

    const commandData: ChatCommandData = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        dispatchId: dispatchId,
        meta: meta
    };

    const createCommand: ChatCommand<DispatchAction> = {
        commonData: commandData,
        actions: ["create"]
    };
    const closeCommand: ChatCommand<DispatchAction> = {
        commonData: commandData,
        actions: ["close"]
    };

    let scheduler: TaskScheduler;

    before(async function() {
        scheduler = imock<TaskScheduler>();
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);
    });

    after(async function() {
        test.cleanup();
    });

    afterEach(async function() {
        reset(scheduler);
        await db.recursiveDelete(chats);
    });

    async function createChat(thread?: string, status?: ChatStatus, dispatch?: string) {
        const dispatchDoc = dispatch || dispatchId;
        const data: ChatState<AiConfig, Data> = {
            ...chatState,
            config: (thread ? {...chatState.config, threadId: thread} : chatState.config),
            ...(status ? {status: status} : {status: "processing"}),
            latestDispatchId: dispatchDoc
        };

        await chatDoc.set(data);
        await chatDispatches.doc(dispatchDoc).set({createdAt: FieldValue.serverTimestamp()});

        const toInsert: ReadonlyArray<ChatMessage> = messages.map((message, index) => ({
            userId: userId,
            author: "user",
            createdAt: Timestamp.now(),
            inBatchSortIndex: index,
            dispatchId: dispatchId,
            text: message
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes command", async function() {
        await createChat(undefined, "processing", dispatchId);

        let passedReq: Request<ChatCommand<unknown>> | null = null;
        let passedAction: DispatchAction | null = null;
        let passedData: ChatCommandData | null = null;
        let passedState: ChatState<AiConfig, Data> | null = null;

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                passedReq = req;
                return true;
            },
            // eslint-disable-next-line max-len
            (action: DispatchAction, data: ChatCommandData, state: ChatState<AiConfig, Data>): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                passedAction = action;
                passedData = data;
                passedState = state;
                return Promise.resolve({
                    status: "complete"
                });
            }
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: closeCommand
        };

        const result = await worker.dispatch(request);

        result.should.be.true;
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });

        expect(passedReq).to.be.equal(request);
        expect(passedAction).to.be.equal("close");
        expect(passedData).to.deep.include({
            ...commandData
        });
        expect(passedState).to.deep.equal({
            ...chatState,
            status: "processing",
            latestDispatchId: dispatchId
        });
    });

    it("sets retry if there are retries", async function() {
        await createChat(threadId, "processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        return worker.dispatch(request)
            .should
            .eventually
            .be.rejectedWith("AI error");
    });

    it("fails chat if there are no retries", async function() {
        await createChat(threadId, "processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );

        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "failed"
        });
    });

    it("completes run on success", async function() {
        await createChat(threadId, "processing");
        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.resolve({
                    status: "userInput"
                });
            }
        );

        await worker.dispatch(request);

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("complete");
    });

    it("completes run on fail", async function() {
        await createChat(threadId, "processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );
        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await worker.dispatch(request);

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("complete");
    });

    it("sets run to retry on retry", async function() {
        await createChat(threadId, "processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await worker.dispatch(request).catch(() => {});

        const run = await chatDispatches.doc(dispatchId).collection(Collections.runs).doc(runId).get();
        run.exists.should.be.true;
        const runData = run.data();
        if (undefined === data) {
            throw new Error("Should have run document");
        }
        (runData as Run).status.should.equal("waitingForRetry");
    });

    it("aborts if running in parallel", async function() {
        await createChat(threadId, "processing");
        await chatDispatches.doc(dispatchId)
            .collection(Collections.runs).doc(runId)
            .set({status: "running", createdAt: FieldValue.serverTimestamp()});

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.resolve({
                    status: "userInput"
                });
            }
        );

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
    });

    it("aborts if already run", async function() {
        await createChat(threadId, "processing");
        await chatDispatches.doc(dispatchId)
            .collection(Collections.runs).doc(runId)
            .set({status: "complete", createdAt: FieldValue.serverTimestamp()});

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.resolve({
                    status: "userInput"
                });
            }
        );

        await worker.dispatch(request);

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
    });

    it("returns false if command is not supported", async function() {
        await createChat(threadId, "processing");
        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: createCommand
        };
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return false;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.reject(new Error("Should not be dispatched!"));
            }
        );

        const result = await worker.dispatch(request);

        result.should.be.false;
    });

    it("runs command batch", async function() {
        await createChat(threadId, "processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.resolve({
                    status: "userInput"
                });
            }
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actions: ["create", "close"]
            }
        };

        await worker.dispatch(request);

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                commonData: commandData,
                actions: ["close"]
            }
        );
    });

    it("runs completion handler", async function() {
        await createChat(threadId, "processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<Partial<ChatState<AiConfig, Data>> | null> => {
                return Promise.resolve({
                    status: "userInput"
                });
            }
        );
        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actions: ["create"]
            }
        };

        let handlerCalled = false;
        await worker.dispatch(request, () => {
            handlerCalled = true;
        });

        handlerCalled.should.be.true;
    });
});

class TestWorker extends BaseChatWorker<DispatchAction, AiConfig, Data> {
    // eslint-disable-next-line max-len
    private readonly isSupportedCommandImpl: (req: Request<ChatCommand<unknown>>) => req is Request<ChatCommand<DispatchAction>>;
    // eslint-disable-next-line max-len
    private readonly doDispatchImpl: (action: DispatchAction, data: ChatCommandData, state: ChatState<AiConfig, Data>) => Promise<Partial<ChatState<AiConfig, Data>> | null>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        // eslint-disable-next-line max-len
        isSupportedCommand: (req: Request<ChatCommand<unknown>>) => req is Request<ChatCommand<DispatchAction>>,
        // eslint-disable-next-line max-len
        doDispatch: (action: DispatchAction, data: ChatCommandData, state: ChatState<AiConfig, Data>) => Promise<Partial<ChatState<AiConfig, Data>> | null>
    ) {
        super(firestore, scheduler);
        this.isSupportedCommandImpl = isSupportedCommand;
        this.doDispatchImpl = doDispatch;
    }

    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> {
        return this.isSupportedCommandImpl(req);
    }

    protected doDispatch(
        action: DispatchAction,
        data: ChatCommandData,
        state: ChatState<AiConfig, Data>
    ): Promise<Partial<ChatState<AiConfig, Data>> | null> {
        return this.doDispatchImpl(action, data, state);
    }
}
