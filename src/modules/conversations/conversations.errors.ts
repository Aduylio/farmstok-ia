export type ConversationErrorCode =
  "CONVERSATION_NOT_FOUND" | "KOMMO_LEAD_CONFLICT" | "HUMAN_MODE_PROTECTED";

export class ConversationError extends Error {
  constructor(readonly code: ConversationErrorCode) {
    super("Nao foi possivel processar a conversa.");
    this.name = "ConversationError";
  }
}
