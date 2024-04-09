import {Meta} from "./Meta";

/**
 * Common command data
 */
export interface ChatCommandData {
    readonly ownerId: string
    readonly chatDocumentPath: string
    readonly dispatchId: string
    readonly meta: Meta | null
}
