import { prisma } from "../../config/prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ChangeActor,
  ConversationEventType,
  ConversationMode,
  ConversationRecord,
} from "./conversations.types.js";
import { ConversationError } from "./conversations.errors.js";

const select = {
  id: true,
  studentId: true,
  consultantId: true,
  mode: true,
  kommoLeadId: true,
  modeChangedAt: true,
  modeChangedBy: true,
} as const;

export interface ConversationsRepository {
  findById(id: string): Promise<ConversationRecord | null>;
  findByStudentId(studentId: string): Promise<ConversationRecord | null>;
  findByKommoLeadId(leadId: string): Promise<ConversationRecord | null>;
  create(studentId: string): Promise<ConversationRecord>;
  attachKommoLead(id: string, leadId: string): Promise<ConversationRecord>;
  transition(
    id: string,
    mode: ConversationMode,
    actor: ChangeActor,
  ): Promise<{ conversation: ConversationRecord; changed: boolean }>;
}

export class PrismaConversationsRepository implements ConversationsRepository {
  constructor(private readonly client: PrismaClient = prisma) {}
  findById(id: string) {
    return this.client.conversation.findUnique({
      where: { id },
      select,
    }) as Promise<ConversationRecord | null>;
  }
  findByStudentId(studentId: string) {
    return this.client.conversation.findFirst({
      where: { studentId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      select,
    }) as Promise<ConversationRecord | null>;
  }
  findByKommoLeadId(kommoLeadId: string) {
    return this.client.conversation.findUnique({
      where: { kommoLeadId },
      select,
    }) as Promise<ConversationRecord | null>;
  }
  create(studentId: string) {
    return this.client.conversation.create({
      data: { studentId, mode: "AI" },
      select,
    }) as Promise<ConversationRecord>;
  }
  async attachKommoLead(id: string, kommoLeadId: string) {
    try {
      return (await this.client.conversation.update({
        where: { id },
        data: { kommoLeadId },
        select,
      })) as ConversationRecord;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new ConversationError("KOMMO_LEAD_CONFLICT");
      throw error;
    }
  }
  transition(
    id: string,
    mode: ConversationMode,
    actor: ChangeActor,
  ): Promise<{ conversation: ConversationRecord; changed: boolean }> {
    return this.client.$transaction(async (transaction) => {
      const current = await transaction.conversation.findUnique({
        where: { id },
        select,
      });
      if (current === null)
        throw new ConversationError("CONVERSATION_NOT_FOUND");
      if (actor === "SYSTEM" && current.mode === "HUMAN" && mode !== "HUMAN")
        throw new ConversationError("HUMAN_MODE_PROTECTED");
      if (current.mode === mode)
        return { conversation: current as ConversationRecord, changed: false };
      const changedAt = new Date();
      const conversation = await transaction.conversation.update({
        where: { id },
        data: { mode, modeChangedAt: changedAt, modeChangedBy: actor },
        select,
      });
      const eventType: ConversationEventType =
        mode === "PAUSED"
          ? "PAUSED"
          : mode === "HUMAN"
            ? "HUMAN_ASSUMED"
            : current.mode === "PAUSED"
              ? "RESUMED"
              : "AI_ASSUMED";
      await transaction.conversationEvent.create({
        data: {
          conversationId: id,
          type: eventType,
          changedBy: actor,
          metadata: { source: actor === "SYSTEM" ? "system" : "human" },
        },
      });
      return {
        conversation: conversation as ConversationRecord,
        changed: true,
      };
    });
  }
}
