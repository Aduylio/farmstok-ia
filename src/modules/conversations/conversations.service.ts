import type { StudentsService } from "../students/students.service.js";
import { resolveAssistantAccess } from "./conversations.access.js";
import { ConversationError } from "./conversations.errors.js";
import {
  inboundConversationSchema,
  kommoLeadIdSchema,
} from "./conversations.schemas.js";
import type { ConversationsRepository } from "./conversations.repository.js";
import type {
  ChangeActor,
  ConversationMode,
  InboundResolution,
} from "./conversations.types.js";

export class ConversationsService {
  constructor(private readonly repository: ConversationsRepository) {}
  findById(id: string) {
    return this.repository.findById(id);
  }
  findByStudentId(id: string) {
    return this.repository.findByStudentId(id);
  }
  findByKommoLeadId(value: string | number) {
    return this.repository.findByKommoLeadId(kommoLeadIdSchema.parse(value));
  }
  async getOrCreateForStudent(studentId: string) {
    const existing = await this.repository.findByStudentId(studentId);
    return existing === null
      ? { conversation: await this.repository.create(studentId), created: true }
      : { conversation: existing, created: false };
  }
  async attachKommoLead(conversationId: string, value: string | number) {
    const leadId = kommoLeadIdSchema.parse(value);
    const conversation = await this.repository.findById(conversationId);
    if (conversation === null)
      throw new ConversationError("CONVERSATION_NOT_FOUND");
    if (conversation.kommoLeadId === leadId) return conversation;
    if (conversation.kommoLeadId !== null)
      throw new ConversationError("KOMMO_LEAD_CONFLICT");
    const owner = await this.repository.findByKommoLeadId(leadId);
    if (owner !== null && owner.studentId !== conversation.studentId)
      throw new ConversationError("KOMMO_LEAD_CONFLICT");
    if (owner !== null) throw new ConversationError("KOMMO_LEAD_CONFLICT");
    return this.repository.attachKommoLead(conversationId, leadId);
  }
  async getMode(id: string) {
    return (await this.repository.findById(id))?.mode ?? null;
  }
  async canAiRespond(id: string) {
    return (await this.repository.findById(id))?.mode === "AI";
  }
  setModeBySystem(
    id: string,
    mode: Extract<ConversationMode, "AI" | "PAUSED">,
  ) {
    return this.setMode(id, mode, "SYSTEM");
  }
  setModeByHuman(id: string, mode: ConversationMode) {
    return this.setMode(id, mode, "CONSULTANT");
  }
  private async setMode(
    id: string,
    mode: ConversationMode,
    actor: ChangeActor,
  ) {
    const current = await this.repository.findById(id);
    if (current === null) throw new ConversationError("CONVERSATION_NOT_FOUND");
    if (actor === "SYSTEM" && current.mode === "HUMAN" && mode !== "HUMAN")
      throw new ConversationError("HUMAN_MODE_PROTECTED");
    if (current.mode === mode) return { conversation: current, changed: false };
    return this.repository.transition(id, mode, actor);
  }
}

export async function resolveInboundConversation(
  input: unknown,
  students: StudentsService,
  conversations: ConversationsService,
): Promise<InboundResolution> {
  const parsed = inboundConversationSchema.parse(input);
  const student = await students.findByPhone(parsed.phone);
  if (student === null)
    return {
      studentId: null,
      conversationId: null,
      allowed: false,
      reason: "STUDENT_NOT_FOUND",
    };
  if (parsed.whatsappId !== undefined)
    await students.attachWhatsappId(student.id, parsed.whatsappId);
  const conversation = await conversations.findByStudentId(student.id);
  const decision = resolveAssistantAccess({
    student,
    conversation,
    ...(parsed.course === undefined ? {} : { course: parsed.course }),
  });
  return {
    studentId: student.id,
    conversationId: conversation?.id ?? null,
    ...decision,
  };
}
