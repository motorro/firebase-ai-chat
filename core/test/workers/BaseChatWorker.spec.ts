import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "../functionsTest";
import {anything, capture, imock, instance, reset, when} from "@johanblumenberg/ts-mockito";
import {AiConfig, chatState, data, Data, DispatchAction, userId} from "../mock";
import {
    ChatCommand,
    ChatCommandData,
    ChatError,
    ChatMessage,
    ChatState,
    ChatStatus,
    Collections,
    Dispatch,
    DispatchControl,
    Meta,
    Run,
    TaskScheduler,
    BaseChatWorker
} from "../../src";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {expect} from "chai";
import CollectionReference = admin.firestore.CollectionReference;
import Timestamp = admin.firestore.Timestamp;
import FieldValue = firestore.FieldValue;

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
        actionData: "create"
    };
    const closeCommand: ChatCommand<DispatchAction> = {
        commonData: commandData,
        actionData: "close"
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

    async function createChat(status?: ChatStatus, dispatch?: string) {
        const dispatchDoc = dispatch || dispatchId;
        const data: ChatState<AiConfig, Data> = {
            ...chatState,
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
            text: message,
            data: null,
            meta: null
        }));
        for (const message of toInsert) {
            await chatMessages.doc().set(message);
        }
    }

    it("processes command", async function() {
        await createChat("processing", dispatchId);

        let passedReq: Request<ChatCommand<unknown>> | null = null;
        let passedCommand: ChatCommand<DispatchAction> | null = null;
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
            async (
                command: ChatCommand<DispatchAction>,
                state: ChatState<AiConfig, Data>,
                control: DispatchControl<DispatchAction, AiConfig, Data>
            ): Promise<void> => {
                passedCommand = command;
                passedState = state;
                await control.updateChatState({status: "complete"});
                return Promise.resolve();
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
        expect(passedCommand).to.be.deep.equal(closeCommand);
        expect(passedState).to.deep.equal({
            ...chatState,
            status: "processing",
            latestDispatchId: dispatchId
        });
    });

    it("sets retry if there are retries", async function() {
        await createChat("processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<void> => {
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
        await createChat("processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<void> => {
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
        await createChat("processing");
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
            async (_command, _state, control): Promise<void> => {
                await control.updateChatState({
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
        await createChat("processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<void> => {
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
        await createChat("processing");

        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            (): Promise<void> => {
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
        await createChat("processing");
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
            async (_command, _state, control): Promise<void> => {
                await control.updateChatState({
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
        await createChat("processing");
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
            async (_command, _state, control): Promise<void> => {
                await control.updateChatState({
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
        await createChat("processing");
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
            (): Promise<void> => {
                return Promise.reject(new Error("Should not be dispatched!"));
            }
        );

        const result = await worker.dispatch(request);

        result.should.be.false;
    });

    it("runs command batch", async function() {
        await createChat("processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            async (command, _state, control): Promise<void> => {
                await control.updateChatState({
                    status: "userInput"
                });
                await control.continueQueue({...command, actionData: "close"});
            }
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actionData: "create"
            }
        };

        await worker.dispatch(request);

        const [name, command] = capture(scheduler.schedule).last();
        name.should.be.equal("Chat");
        command.should.deep.include(
            {
                commonData: commandData,
                actionData: "close"
            }
        );
    });

    it("runs completion handler", async function() {
        await createChat("processing");
        const worker = new TestWorker(
            db,
            instance(scheduler),
            // eslint-disable-next-line max-len
            (req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> => {
                return true;
            },
            // eslint-disable-next-line max-len
            async (_command, _state, control): Promise<void> => {
                await control.completeQueue();
                await control.updateChatState({
                    status: "userInput"
                });
            }
        );
        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: {
                commonData: commandData,
                actionData: "create"
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
    private readonly doDispatchImpl: (
        command: ChatCommand<DispatchAction>,
        state: ChatState<AiConfig, Data>,
        control: DispatchControl<DispatchAction, AiConfig, Data>
    ) => Promise<void>;

    constructor(
        firestore: FirebaseFirestore.Firestore,
        scheduler: TaskScheduler,
        // eslint-disable-next-line max-len
        isSupportedCommand: (req: Request<ChatCommand<unknown>>) => req is Request<ChatCommand<DispatchAction>>,
        // eslint-disable-next-line max-len
        doDispatch: (
            command: ChatCommand<DispatchAction>,
            state: ChatState<AiConfig, Data>,
            control: DispatchControl<DispatchAction, AiConfig, Data>
        ) => Promise<void>
    ) {
        super(firestore, scheduler, instance(imock()), false);
        this.isSupportedCommandImpl = isSupportedCommand;
        this.doDispatchImpl = doDispatch;
    }

    protected isSupportedCommand(req: Request<ChatCommand<unknown>>): req is Request<ChatCommand<DispatchAction>> {
        return this.isSupportedCommandImpl(req);
    }

    protected doDispatch(
        command: ChatCommand<DispatchAction>,
        state: ChatState<AiConfig, Data>,
        control: DispatchControl<DispatchAction, AiConfig, Data>
    ): Promise<void> {
        return this.doDispatchImpl(command, state, control);
    }
}
