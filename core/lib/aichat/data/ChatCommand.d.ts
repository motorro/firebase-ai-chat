import { ChatCommandData } from "./ChatCommandData";
/**
 * Chat command type
 */
export interface ChatCommand<A> extends Record<string, unknown> {
    readonly commonData: ChatCommandData;
    readonly actions: ReadonlyArray<A>;
}
