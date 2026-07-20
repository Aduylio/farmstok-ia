import type { FastifyInstance } from 'fastify';

import { createKnowledgeSourceBodySchema } from './knowledge-ingestion.schemas.js';
import {
  DuplicateKnowledgeChunkError,
  PrismaKnowledgeIngestionRepository,
} from './knowledge-ingestion.repository.js';
import { KnowledgeIngestionService } from './knowledge-ingestion.service.js';

export function createKnowledgeIngestionRoutes(
  service: KnowledgeIngestionService,
) {
  return async function knowledgeIngestionRoutes(app: FastifyInstance) {
    app.post('/sources', async (request, reply) => {
      const parsedBody = createKnowledgeSourceBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Os dados enviados são inválidos.',
          details: parsedBody.error.flatten().fieldErrors,
        });
      }

      try {
        const result = await service.ingest(parsedBody.data);
        return reply.status(201).send(result);
      } catch (error) {
        if (error instanceof DuplicateKnowledgeChunkError) {
          return reply.status(409).send({
            error: 'DUPLICATE_CONTENT',
            message: 'Um ou mais chunks já existem nesta fonte.',
          });
        }

        request.log.error('Falha interna ao ingerir fonte de conhecimento.');

        return reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Não foi possível cadastrar a fonte de conhecimento.',
        });
      }
    });
  };
}

const repository = new PrismaKnowledgeIngestionRepository();
const service = new KnowledgeIngestionService(repository);

export const knowledgeIngestionRoutes = createKnowledgeIngestionRoutes(service);
