import { z } from 'zod';
import { knowledgeSourceTypes, sourceKeySchema } from '../knowledge-ingestion/knowledge-ingestion.schemas.js';
export const knowledgeAnswerRequestSchema = z.object({ question: z.string().trim().min(3).max(500), sourceKey: sourceKeySchema.optional(), course: z.string().trim().min(1).max(200).optional(), type: z.enum(knowledgeSourceTypes).optional() });
export type KnowledgeAnswerRequest = z.infer<typeof knowledgeAnswerRequestSchema>;
