import { z } from "zod";

export const studentNameSchema = z.string().trim().min(1).max(200);
export const whatsappIdSchema = z.string().trim().min(1).max(200);
export const courseAccessSchema = z.object({
  courses: z.array(z.string().trim().min(1).max(200)).min(1),
  activeUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u)
    .optional(),
});
