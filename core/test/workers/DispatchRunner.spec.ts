import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "../functionsTest";
import {anything, imock, instance, reset, when} from "@johanblumenberg/ts-mockito";
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
    DispatchRunner,
    Meta,
    Run,
    TaskScheduler
} from "../../src";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {expect} from "chai";
import CollectionReference = admin.firestore.CollectionReference;
import Timestamp = admin.firestore.Timestamp;
import FieldValue = firestore.FieldValue;
import {beforeEach} from "mocha";

const messages: ReadonlyArray<string> = ["Hello", "How are you?"];
describe("Dispatch runner", function() {
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

    let scheduler: TaskScheduler;
    let runner: DispatchRunner<DispatchAction, AiConfig, Data>;

    before(async function() {
        scheduler = imock<TaskScheduler>();
        runner = new DispatchRunner(db, instance(scheduler), false);
    });

    beforeEach(function() {
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

        let passedState: ChatState<AiConfig, Data> | null = null;

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };

        await runner.dispatchWithCheck(
            request,
            async (soFar, command, updateState) => {
                passedState = soFar;
                await updateState({status: "complete"});
            }
        );

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "complete"
        });

        expect(passedState).to.deep.equal({
            ...chatState,
            status: "processing",
            latestDispatchId: dispatchId
        });
    });

    it("sets retry if there are retries", async function() {
        await createChat("processing");

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };

        return runner.dispatchWithCheck(
            request,
            async () => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        ).should.eventually.be.rejectedWith("AI error");
    });

    it("fails chat if there are no retries", async function() {
        await createChat("processing");

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        when(scheduler.getQueueMaxRetries(anything())).thenResolve(10);

        await runner.dispatchWithCheck(
            request,
            async () => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );

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
        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };

        await runner.dispatchWithCheck(
            request,
            async (soFar, command, updateState) => {
                await updateState({
                    status: "userInput"
                });
            }
        );

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

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            retryCount: 9,
            data: createCommand
        };

        await runner.dispatchWithCheck(
            request,
            async () => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        );

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

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };


        await runner.dispatchWithCheck(
            request,
            async () => {
                return Promise.reject(new ChatError("internal", false, "AI error"));
            }
        ).catch(() => { }); // eslint-disable-line @typescript-eslint/no-empty-function

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

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await runner.dispatchWithCheck(
            request,
            async (soFar, command, updateState) => {
                await updateState({
                    status: "userInput"
                });
            }
        );

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

        const request: Request<ChatCommand<DispatchAction>> = {
            ...context,
            data: createCommand
        };

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await runner.dispatchWithCheck(
            request,
            async (soFar, command, updateState) => {
                await updateState({
                    status: "userInput"
                });
            }
        );

        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            status: "processing"
        });
    });
});
