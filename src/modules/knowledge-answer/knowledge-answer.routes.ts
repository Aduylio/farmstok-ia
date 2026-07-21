import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { AnswerProviderError } from '../ai/answer.errors.js';
import { OpenAIAnswerProvider } from '../ai/openai-answer.provider.js';
import { OpenAIEmbeddingProvider } from '../knowledge-ingestion/openai-embedding.provider.js';
import { KnowledgeHybridSearchService } from '../knowledge-hybrid-search/knowledge-hybrid-search.service.js';
import { PrismaKnowledgeSearchRepository } from '../knowledge/knowledge-search.repository.js';
import { KnowledgeSearchService } from '../knowledge/knowledge-search.service.js';
import { PrismaKnowledgeVectorSearchRepository } from '../knowledge-vector-search/knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../knowledge-vector-search/knowledge-vector-search.service.js';
import { knowledgeAnswerRequestSchema } from './knowledge-answer.schemas.js';
import { InvalidProviderResponseError, KnowledgeAnswerService } from './knowledge-answer.service.js';

export function createKnowledgeAnswerRoutes(service: KnowledgeAnswerService) {
  return async function knowledgeAnswerRoutes(app: FastifyInstance) {
    app.post('/ask', async (request, reply) => {
      const parsed = knowledgeAnswerRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Os dados enviados sao invalidos.', details: parsed.error.flatten().fieldErrors });
      try { return reply.status(200).send(await service.ask(parsed.data)); }
      catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
        if (error instanceof InvalidProviderResponseError || code === 'INVALID_PROVIDER_RESPONSE') return reply.status(502).send({ error: 'INVALID_PROVIDER_RESPONSE', message: 'O provedor retornou uma resposta invalida.' });
        if (error instanceof AnswerProviderError || error instanceof EmbeddingProviderUnavailableError || (typeof code === 'string' && code.startsWith('ANSWER_PROVIDER_'))) return reply.status(503).send({ error: 'ANSWER_PROVIDER_UNAVAILABLE', message: 'O provedor de respostas nao esta disponivel.' });
        request.log.error('Falha interna ao responder pergunta.'); return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Nao foi possivel responder a pergunta.' });
      }
    });
  };
}

const vector = new KnowledgeVectorSearchService(new PrismaKnowledgeVectorSearchRepository(), () => { if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError(); return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS }); });
const hybrid = new KnowledgeHybridSearchService(new KnowledgeSearchService(new PrismaKnowledgeSearchRepository()), vector);
const service = new KnowledgeAnswerService(hybrid, () => {
  if (env.OPENAI_API_KEY === undefined || env.OPENAI_ANSWER_MODEL === undefined) throw new AnswerProviderError('ANSWER_PROVIDER_UNAVAILABLE');
  return OpenAIAnswerProvider.fromConfig(env.OPENAI_API_KEY, env.OPENAI_ANSWER_MODEL);
}, env.KNOWLEDGE_ANSWER_MAX_CONTEXT_CHARS);
export const knowledgeAnswerRoutes = createKnowledgeAnswerRoutes(service);
