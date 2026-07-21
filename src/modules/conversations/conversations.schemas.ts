import { z } from "zod";

export const kommoLeadIdSchema = z.union([
  z.string().regex(/^[1-9]\d*$/u),
  z.number().int().positive().safe().transform(String),
]);

export const inboundConversationSchema = z.object({
  phone: z.string().min(1),
  whatsappId: z.string().trim().min(1).max(200).optional(),
  course: z.string().trim().min(1).max(200).optional(),
});
