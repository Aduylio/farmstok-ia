import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { OpenAIEmbeddingProvider } from '../src/modules/knowledge-ingestion/openai-embedding.provider.js';
import { PrismaKnowledgeSearchRepository } from '../src/modules/knowledge/knowledge-search.repository.js';
import { KnowledgeSearchService } from '../src/modules/knowledge/knowledge-search.service.js';
import { PrismaKnowledgeVectorSearchRepository } from '../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../src/modules/knowledge-vector-search/knowledge-vector-search.service.js';
import { parseHybridSearchCliArgs } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.cli.js';
import { knowledgeHybridSearchQuerySchema } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.schemas.js';
import { KnowledgeHybridSearchService } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.service.js';

try {
  const parsed = knowledgeHybridSearchQuerySchema.safeParse(parseHybridSearchCliArgs(process.argv.slice(2)));
  if (!parsed.success) throw new Error('INVALID_ARGUMENTS');
  const vector = new KnowledgeVectorSearchService(new PrismaKnowledgeVectorSearchRepository(), () => { if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError(); return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS }); });
  const response = await new KnowledgeHybridSearchService(new KnowledgeSearchService(new PrismaKnowledgeSearchRepository()), vector).search(parsed.data);
  console.log(`Modo: ${response.mode}`);
  if (response.reason === 'VECTOR_UNAVAILABLE') console.log('Busca vetorial: indisponivel por ausencia de embeddings');
  if (response.results.length === 0) console.log('Nenhum resultado relevante.');
  response.results.forEach((result, index) => console.log(`\n${index + 1}. ${result.source.title}\nFonte: ${result.source.sourceKey}\nScore hibrido: ${result.hybridScore.toFixed(4)}\nEncontrado por: ${result.matchedBy.join(', ')}\nHorario: ${result.startTime ?? 'nao informado'}\nLink: ${result.source.timestampUrl ?? result.source.sourceUrl ?? 'nao informado'}\nTrecho: ${result.content.replace(/\s+/gu, ' ').trim().slice(0, 240)}`));
} catch { console.error('Nao foi possivel executar a busca hibrida.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
