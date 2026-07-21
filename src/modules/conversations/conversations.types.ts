import type {
  StudentAccessReason,
  StudentRecord,
} from "../students/students.types.js";

export type ConversationMode = "AI" | "HUMAN" | "PAUSED";
export type ChangeActor = "SYSTEM" | "AI" | "CONSULTANT" | "STUDENT";
export type ConversationEventType =
  "PAUSED" | "RESUMED" | "HUMAN_ASSUMED" | "AI_ASSUMED";

export interface ConversationRecord {
  id: string;
  studentId: string;
  consultantId: string | null;
  mode: ConversationMode;
  kommoLeadId: string | null;
  modeChangedAt: Date | null;
  modeChangedBy: ChangeActor | null;
}

export type AssistantAccessReason =
  | StudentAccessReason
  | "CONVERSATION_NOT_FOUND"
  | "CONVERSATION_PAUSED"
  | "CONVERSATION_HUMAN";

export interface AssistantAccessDecision {
  allowed: boolean;
  reason: AssistantAccessReason | null;
}

export interface InboundResolution extends AssistantAccessDecision {
  studentId: string | null;
  conversationId: string | null;
}

export interface AssistantAccessInput {
  student: StudentRecord | null;
  conversation: ConversationRecord | null;
  course?: string;
  now?: Date;
}
