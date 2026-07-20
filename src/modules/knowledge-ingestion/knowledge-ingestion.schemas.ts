import { z } from 'zod';

const knowledgeSourceTypes = [
  'AULA',
  'LIVE',
  'MENTORIA',
  'PDF',
  'FAQ',
  'OUTRO',
] as const;

export const sourceKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9:_-]*$/u);

export const knowledgeSourceMetadataSchema = z.object({
  sourceKey: sourceKeySchema,
  type: z.enum(knowledgeSourceTypes),
  title: z.string().trim().min(1).max(300),
  course: z.string().trim().min(1).max(200),
  module: z.string().trim().min(1).max(200).optional(),
  lessonNumber: z.number().int().positive().optional(),
  sourceUrl: z.string().url().optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
  version: z.number().int().positive().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  storagePath: z.string().trim().min(1).max(1000).optional(),
  instructor: z.string().trim().min(1).max(200).optional(),
});

export const createKnowledgeSourceBodySchema = knowledgeSourceMetadataSchema.extend({
  content: z.string().trim().min(1, 'O conteúdo não pode estar vazio.'),
});

export type CreateKnowledgeSourceBody = z.infer<
  typeof createKnowledgeSourceBodySchema
>;

export interface KnowledgeIngestionResponse {
  source: {
    id: string;
    sourceKey: string;
    type: CreateKnowledgeSourceBody['type'];
    title: string;
    course: string;
  };
  ingestion: {
    chunksCreated: number;
    charactersProcessed: number;
  };
}
