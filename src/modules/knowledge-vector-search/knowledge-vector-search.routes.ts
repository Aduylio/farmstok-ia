import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env.js';
import { OpenAIEmbeddingProvider } from '../knowledge-ingestion/openai-embedding.provider.js';
import { knowledgeVectorSearchQuerySchema } from './knowledge-vector-search.schemas.js';
import { PrismaKnowledgeVectorSearchRepository } from './knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from './knowledge-vector-search.service.js';

export function createKnowledgeVectorSearchRoutes(service: KnowledgeVectorSearchService) {
  return async function knowledgeVectorSearchRoutes(app: FastifyInstance) {
    app.get('/vector-search', async (request, reply) => {
      const parsed = knowledgeVectorSearchQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Os parÃ¢metros da busca vetorial sÃ£o invÃ¡lidos.', details: parsed.error.flatten().fieldErrors });
      try {
        return reply.status(200).send(await service.search(parsed.data));
      } catch (error) {
        if (error instanceof EmbeddingProviderUnavailableError) {
          return reply.status(503).send({ error: 'EMBEDDING_PROVIDER_UNAVAILABLE', message: 'O provedor de embeddings nÃ£o estÃ¡ disponÃ­vel.' });
        }
        request.log.error('Falha interna na busca vetorial.');
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'NÃ£o foi possÃ­vel pesquisar a base vetorial.' });
      }
    });
  };
}

const repository = new PrismaKnowledgeVectorSearchRepository();
const service = new KnowledgeVectorSearchService(repository, () => {
  if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError();
  return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS });
});
export const knowledgeVectorSearchRoutes = createKnowledgeVectorSearchRoutes(service);
