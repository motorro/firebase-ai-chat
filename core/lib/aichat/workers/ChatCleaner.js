"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonChatCleaner = exports.CommonChatCleanupRegistrar = void 0;
const logging_1 = require("../../logging");
const Collections_1 = require("../data/Collections");
const ChatCommand_1 = require("../data/ChatCommand");
const logger = (0, logging_1.tagLogger)("Cleaner");
class CommonChatCleanupRegistrar {
    /**
     * Constructor
     * @param db Firestore
     */
    constructor(db) {
        this.db = db;
    }
    async register(command) {
        logger.d("Registering cleanup: ", JSON.stringify(command));
        const chatDoc = this.db.doc(command.commonData.chatDocumentPath);
        const cleanup = chatDoc.collection(Collections_1.Collections.cleanup);
        await cleanup.doc().set(command);
    }
}
exports.CommonChatCleanupRegistrar = CommonChatCleanupRegistrar;
class CommonChatCleaner {
    /**
     * Constructor
     * @param db Firestore
     * @param scheduler Task scheduler
     * @param queueName Task queue name for cleanup
     */
    constructor(db, scheduler, queueName) {
        this.db = db;
        this.scheduler = scheduler;
        this.queueName = queueName;
    }
    async cleanup(chatDocumentPath) {
        logger.d("Cleanup requested for: ", chatDocumentPath);
        const chatDoc = this.db.doc(chatDocumentPath);
        const cleanup = chatDoc.collection(Collections_1.Collections.cleanup);
        const commands = (await cleanup.get()).docs;
        for (const commandDoc of commands) {
            const command = commandDoc.data();
            if (undefined === command) {
                continue;
            }
            logger.d("Cleaning-up: ", JSON.stringify(command));
            if ((0, ChatCommand_1.isBoundChatCommand)(command)) {
                await this.scheduler.schedule(command.queueName, command.command);
            }
            else {
                await this.scheduler.schedule(this.queueName, command);
            }
        }
    }
}
exports.CommonChatCleaner = CommonChatCleaner;
//# sourceMappingURL=ChatCleaner.js.map