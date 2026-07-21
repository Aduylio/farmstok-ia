import { z } from 'zod';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { knowledgeSourceTypes, sourceKeySchema } from '../src/modules/knowledge-ingestion/knowledge-ingestion.schemas.js';
import { OpenAIEmbeddingProvider } from '../src/modules/knowledge-ingestion/openai-embedding.provider.js';
import { parseVectorSearchCliArgs } from '../src/modules/knowledge-vector-search/knowledge-vector-search.cli.js';
import { PrismaKnowledgeVectorSearchRepository } from '../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../src/modules/knowledge-vector-search/knowledge-vector-search.service.js';

const cliSchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sourceKey: sourceKeySchema.optional(),
  course: z.string().trim().min(1).max(200).optional(),
  type: z.enum(knowledgeSourceTypes).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).default(0),
});

function excerpt(content: string): string {
  const value = content.replace(/\s+/gu, ' ').trim();
  return value.length <= 240 ? value : `${value.slice(0, 237)}...`;
}

try {
  const parsed = cliSchema.safeParse(parseVectorSearchCliArgs(process.argv.slice(2)));
  if (!parsed.success) throw new Error('INVALID_ARGUMENTS');
  const service = new KnowledgeVectorSearchService(new PrismaKnowledgeVectorSearchRepository(), () => {
    if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError();
    return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS });
  });
  const response = await service.search(parsed.data);
  if (response.reason === 'NO_EMBEDDINGS_AVAILABLE') {
    console.log('Nenhum embedding disponÃ­vel.');
    console.log('Execute primeiro o backfill de embeddings.');
  } else if (response.reason === 'NO_RELEVANT_RESULTS') {
    console.log('Nenhum resultado vetorial relevante.');
  } else {
    console.log(`Resultados para: ${response.query} (${response.total})`);
    response.results.forEach((result, index) => console.log(`\n${index + 1}. ${result.source.title}\nFonte: ${result.source.sourceKey}\nSimilaridade: ${result.similarity}\nHorÃ¡rio: ${result.startTime ?? 'nÃ£o informado'}\nLink: ${result.source.timestampUrl ?? result.source.sourceUrl ?? 'nÃ£o informado'}\nTrecho: ${excerpt(result.content)}`));
  }
} catch (error) {
  if (error instanceof EmbeddingProviderUnavailableError) console.error('Provedor de embeddings indisponÃ­vel.');
  else if (error instanceof Error && error.message === 'INVALID_ARGUMENTS') console.error('Uso: npm run knowledge:vector-search -- "consulta" [opÃ§Ãµes]');
  else console.error('NÃ£o foi possÃ­vel executar a busca vetorial.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
