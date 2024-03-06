/**
 * Open AI chat config
 */
export interface ChatConfig {
    readonly assistantId: string,
    readonly workerName: string,
    readonly dispatcherId: string,
    readonly threadId?: string
}
