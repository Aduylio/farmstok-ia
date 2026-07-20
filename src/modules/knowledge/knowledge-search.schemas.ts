import { z } from 'zod';

import {
  knowledgeSourceTypes,
  sourceKeySchema,
} from '../knowledge-ingestion/knowledge-ingestion.schemas.js';

export const knowledgeSearchQuerySchema = z.object({
  q: z
    .string()
    .max(500)
    .refine((value) => value.trim().length > 0, 'A consulta não pode estar vazia.'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sourceKey: sourceKeySchema.optional(),
  course: z.string().trim().min(1).max(200).optional(),
  type: z.enum(knowledgeSourceTypes).optional(),
});

export type KnowledgeSearchQuery = z.infer<typeof knowledgeSearchQuerySchema>;
export type KnowledgeSourceType = (typeof knowledgeSourceTypes)[number];

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  score: number;
  startTime: string | null;
  endTime: string | null;
  source: {
    id: string;
    sourceKey: string;
    type: KnowledgeSourceType;
    title: string;
    course: string;
    module: string | null;
    sourceUrl: string | null;
    timestampUrl: string | null;
  };
}

export interface KnowledgeSearchResponse {
  query: string;
  results: KnowledgeSearchResult[];
  total: number;
}
