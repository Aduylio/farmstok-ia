import { z } from 'zod';

export const askQuestionBodySchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'A pergunta deve possuir pelo menos 3 caracteres.')
    .max(1000, 'A pergunta deve possuir no máximo 1000 caracteres.'),
});

export type AskQuestionBody = z.infer<typeof askQuestionBodySchema>;

export interface KnowledgeSource {
  title: string;
  module: string | null;
  lessonNumber: number | null;
  url: string | null;
  startTime: string | null;
}

export interface KnowledgeAnswer {
  answer: string;
  confidence: number;
  needsHuman: boolean;
  sources: KnowledgeSource[];
}