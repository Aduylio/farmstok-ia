import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { OpenAIEmbeddingProvider } from '../knowledge-ingestion/openai-embedding.provider.js';
import { PrismaKnowledgeSearchRepository } from '../knowledge/knowledge-search.repository.js';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service.js';
import { PrismaKnowledgeVectorSearchRepository } from '../knowledge-vector-search/knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../knowledge-vector-search/knowledge-vector-search.service.js';
import { knowledgeHybridSearchQuerySchema } from './knowledge-hybrid-search.schemas.js';
import { KnowledgeHybridSearchService } from './knowledge-hybrid-search.service.js';

export function createKnowledgeHybridSearchRoutes(service: KnowledgeHybridSearchService) {
  return async function knowledgeHybridSearchRoutes(app: FastifyInstance) {
    app.get('/hybrid-search', async (request, reply) => {
      const parsed = knowledgeHybridSearchQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Os parametros da busca hibrida sao invalidos.', details: parsed.error.flatten().fieldErrors });
      try { return reply.status(200).send(await service.search(parsed.data)); }
      catch { request.log.error('Falha interna na busca hibrida.'); return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Nao foi possivel pesquisar a base de conhecimento.' }); }
    });
  };
}

const textService = new KnowledgeSearchService(new PrismaKnowledgeSearchRepository());
const vectorService = new KnowledgeVectorSearchService(new PrismaKnowledgeVectorSearchRepository(), () => {
  if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError();
  return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS });
});
export const knowledgeHybridSearchRoutes = createKnowledgeHybridSearchRoutes(new KnowledgeHybridSearchService(textService, vectorService));
