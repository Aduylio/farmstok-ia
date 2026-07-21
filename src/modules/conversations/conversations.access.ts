import { canUseAssistant } from "../students/students.access.js";
import type {
  AssistantAccessDecision,
  AssistantAccessInput,
} from "./conversations.types.js";

export function resolveAssistantAccess(
  input: AssistantAccessInput,
): AssistantAccessDecision {
  const student = canUseAssistant(input.student, input.course, input.now);
  if (!student.allowed) return student;
  if (input.conversation === null)
    return { allowed: false, reason: "CONVERSATION_NOT_FOUND" };
  if (input.conversation.mode === "PAUSED")
    return { allowed: false, reason: "CONVERSATION_PAUSED" };
  if (input.conversation.mode === "HUMAN")
    return { allowed: false, reason: "CONVERSATION_HUMAN" };
  return { allowed: true, reason: null };
}
