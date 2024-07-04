import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import {db, test} from "../functionsTest";
import {anything, deepEqual, imock, instance, reset, verify, when} from "@johanblumenberg/ts-mockito";
import {AiConfig, chatState, Data, DispatchAction, userId} from "../mock";
import {
    ChatCleaner,
    ChatCommand,
    ChatCommandData,
    ChatState,
    ChatStatus,
    Collections,
    CommandScheduler,
    HandBackWorker,
    HandOverDelegate,
    HandOverWorker,
    TaskScheduler
} from "../../src";
import {Request, TaskContext} from "firebase-functions/lib/common/providers/tasks";
import {ChatContextStackEntry} from "../../src/aichat/data/ChatState";
import CollectionReference = admin.firestore.CollectionReference;

describe("Hand-over workers", function() {
    const chats = firestore().collection("chats") as CollectionReference<ChatState<AiConfig, Data>>;
    const chatDoc = chats.doc();
    const dispatchId = "dispatchId";
    const runId = "runId";

    const context: TaskContext = {
        executionCount: 0,
        id: runId,
        queueName: "Chat",
        retryCount: 0,
        scheduledTime: ""
    };

    const commandData: ChatCommandData = {
        ownerId: userId,
        chatDocumentPath: chatDoc.path,
        dispatchId: dispatchId,
        meta: null
    };

    const handOverCommand: ChatCommand<DispatchAction> = {
        commonData: commandData,
        actionData: {name: "handOver", config: {engine: "other"}, messages: ["Message 1"]}
    };
    const handBackCommand: ChatCommand<DispatchAction> = {
        commonData: commandData,
        actionData: {name: "handBack", messages: ["Message 1"]}
    };

    let taskScheduler: TaskScheduler;
    let commandScheduler: CommandScheduler;
    let cleaner: ChatCleaner;

    before(async function() {
        taskScheduler = imock<TaskScheduler>();
        commandScheduler = imock<CommandScheduler>();
        cleaner = imock<ChatCleaner>();
    });

    after(async function() {
        test.cleanup();
    });

    beforeEach(function() {
        when(taskScheduler.getQueueMaxRetries(anything())).thenResolve(10);
        when(commandScheduler.isSupported(anything())).thenReturn(true);
    });

    afterEach(async function() {
        reset(taskScheduler);
        reset(commandScheduler);
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
    }

    it("processes hand-over command", async function() {
        when(commandScheduler.handOver(anything(), anything())).thenResolve();
        await createChat("processing", dispatchId);
        const worker = new HandOverWorker(
            db,
            instance(taskScheduler),
            instance(cleaner),
            false,
            [instance(commandScheduler)]
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: handOverCommand
        };

        const result = await worker.dispatch(request);

        result.should.be.true;
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: {
                assistantConfig: {
                    engine: "other"
                }
            }
        });

        const savedStateDocs = await chatDoc.collection(Collections.contextStack)
            .orderBy("createdAt", "desc")
            .limit(1)
            .get();
        savedStateDocs.docs.length.should.equal(1);
        const savedState = savedStateDocs.docs[0].data() as ChatContextStackEntry<Data>;
        savedState.should.deep.include({
            config: chatState.config,
            meta: {
                userMessageMeta: {
                    name: "Vasya"
                }
            }
        });

        verify(commandScheduler.isSupported(deepEqual({engine: "other"}))).once();
        verify(commandScheduler.handOver(anything(), deepEqual(["Message 1"]))).once();
    });

    it("processes hand-back command", async function() {
        when(commandScheduler.handBack(anything(), anything())).thenResolve();

        await createChat("userInput");
        await db.runTransaction(async (tx) => {
            await new HandOverDelegate(db, [instance(commandScheduler)]).handOver(
                tx,
                chatDoc,
                chatState,
                {
                    config: {engine: "other"}
                }
            );
        });

        const worker = new HandBackWorker(
            db,
            instance(taskScheduler),
            instance(cleaner),
            false,
            [instance(commandScheduler)]
        );

        const request: Request<ChatCommand<unknown>> = {
            ...context,
            data: handBackCommand
        };

        const result = await worker.dispatch(request);

        result.should.be.true;
        const chatStateUpdate = await chatDoc.get();
        const updatedChatState = chatStateUpdate.data() as ChatState<AiConfig, Data>;
        if (undefined === updatedChatState) {
            throw new Error("Should have chat status");
        }
        updatedChatState.should.deep.include({
            config: chatState.config
        });

        verify(commandScheduler.isSupported(deepEqual(chatState.config.assistantConfig))).once();
        verify(commandScheduler.handBack(anything(), deepEqual(["Message 1"]))).once();
    });
});
