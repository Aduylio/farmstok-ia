import type { FastifyInstance } from 'fastify';

import { knowledgeSearchQuerySchema } from './knowledge-search.schemas.js';
import { PrismaKnowledgeSearchRepository } from './knowledge-search.repository.js';
import { KnowledgeSearchService } from './knowledge-search.service.js';

export function createKnowledgeSearchRoutes(service: KnowledgeSearchService) {
  return async function knowledgeSearchRoutes(app: FastifyInstance) {
    app.get('/search', async (request, reply) => {
      const parsedQuery = knowledgeSearchQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Os parâmetros da busca são inválidos.',
          details: parsedQuery.error.flatten().fieldErrors,
        });
      }

      try {
        return reply.status(200).send(await service.search(parsedQuery.data));
      } catch {
        request.log.error('Falha interna ao pesquisar conhecimento.');
        return reply.status(500).send({
          error: 'INTERNAL_ERROR',
          message: 'Não foi possível pesquisar a base de conhecimento.',
        });
      }
    });
  };
}

const repository = new PrismaKnowledgeSearchRepository();
const service = new KnowledgeSearchService(repository);

export const knowledgeSearchRoutes = createKnowledgeSearchRoutes(service);
