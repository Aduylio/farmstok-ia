import { z } from 'zod';

export const generatedAnswerSchema = z.object({
  answer: z.string().trim().min(1), confidence: z.number().min(0).max(1),
  needsHuman: z.boolean(), usedChunkIds: z.array(z.string().uuid()).max(5),
  reason: z.string().trim().min(1).nullable(),
});
export type GeneratedAnswer = z.infer<typeof generatedAnswerSchema>;
