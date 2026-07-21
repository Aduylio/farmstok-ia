import { z } from 'zod';
import { knowledgeSourceTypes, sourceKeySchema } from '../knowledge-ingestion/knowledge-ingestion.schemas.js';

export const knowledgeHybridSearchQuerySchema = z.object({
  q: z.string().max(500).refine((value) => value.trim().length > 0),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sourceKey: sourceKeySchema.optional(), course: z.string().trim().min(1).max(200).optional(),
  type: z.enum(knowledgeSourceTypes).optional(), minSimilarity: z.coerce.number().min(0).max(1).default(0),
  textWeight: z.coerce.number().min(0).max(1).default(0.4),
  vectorWeight: z.coerce.number().min(0).max(1).default(0.6),
}).refine((value) => value.textWeight + value.vectorWeight > 0, { message: 'Ao menos um peso deve ser maior que zero.' });
