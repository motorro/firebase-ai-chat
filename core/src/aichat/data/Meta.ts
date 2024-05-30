/**
 * Common metadata
 */
export type Meta = Readonly<Record<string, unknown>>;

/**
 * Chat metadata
 */
export interface ChatMeta extends Meta {
    /**
     * Meta to add to every AI message in chat
     */
    readonly aiMessageMeta?: Meta

    /**
     * Meta to add to every User message in chat
     */
    readonly userMessageMeta?: Meta
}