import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { OpenAIAnswerProvider } from '../src/modules/ai/openai-answer.provider.js';
import { OpenAIEmbeddingProvider } from '../src/modules/knowledge-ingestion/openai-embedding.provider.js';
import { parseAskCliArgs } from '../src/modules/knowledge-answer/knowledge-answer.cli.js';
import { buildKnowledgeAnswerContext } from '../src/modules/knowledge-answer/knowledge-context-builder.js';
import { KnowledgeAnswerService } from '../src/modules/knowledge-answer/knowledge-answer.service.js';
import { KnowledgeHybridSearchService } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.service.js';
import { PrismaKnowledgeSearchRepository } from '../src/modules/knowledge/knowledge-search.repository.js';
import { KnowledgeSearchService } from '../src/modules/knowledge/knowledge-search.service.js';
import { PrismaKnowledgeVectorSearchRepository } from '../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../src/modules/knowledge-vector-search/knowledge-vector-search.service.js';

async function confirm(yes: boolean) { if (yes) return; if (!stdin.isTTY) throw new Error('CONFIRMATION_REQUIRED'); const prompt = createInterface({ input: stdin, output: stdout }); try { if (await prompt.question('Digite GERAR para confirmar a chamada paga: ') !== 'GERAR') throw new Error('CANCELLED'); } finally { prompt.close(); } }
try {
  const options = parseAskCliArgs(process.argv.slice(2));
  const vector = new KnowledgeVectorSearchService(new PrismaKnowledgeVectorSearchRepository(), () => { if (env.OPENAI_API_KEY === undefined) throw new EmbeddingProviderUnavailableError(); return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, { maxRetries: env.EMBEDDING_MAX_RETRIES, retryBaseMs: env.EMBEDDING_RETRY_BASE_MS }); });
  const hybrid = new KnowledgeHybridSearchService(new KnowledgeSearchService(new PrismaKnowledgeSearchRepository()), vector);
  if (!options.execute) {
    const search = await hybrid.search({ q: options.question, limit: 5, minSimilarity: 0, textWeight: 0.4, vectorWeight: 0.6 }); const context = buildKnowledgeAnswerContext(options.question, search.results, env.KNOWLEDGE_ANSWER_MAX_CONTEXT_CHARS);
    console.log('Modo: dry-run'); console.log(`Modo da busca: ${search.mode}`); console.log(`Chunks: ${context.chunks.length}`); console.log(`Omitidos: ${context.omittedChunks}`);
    context.chunks.forEach((item, index) => console.log(`\n${index + 1}. ${item.source.title}\nFonte: ${item.source.sourceKey}\nHorario: ${item.startTime ?? 'nao informado'}\nTrecho: ${item.content.replace(/\s+/gu, ' ').slice(0, 180)}`));
  } else {
    await confirm(options.yes); const apiKey = env.OPENAI_API_KEY; const model = env.OPENAI_ANSWER_MODEL; if (apiKey === undefined || model === undefined) throw new Error('ANSWER_PROVIDER_UNAVAILABLE');
    const answer = await new KnowledgeAnswerService(hybrid, () => OpenAIAnswerProvider.fromConfig(apiKey, model), env.KNOWLEDGE_ANSWER_MAX_CONTEXT_CHARS).ask({ question: options.question });
    console.log(`Resposta: ${answer.answer}\nConfianca: ${answer.confidence}\nPrecisa de humano: ${answer.needsHuman ? 'sim' : 'nao'}\nFontes: ${answer.sources.length}`);
  }
} catch { console.error('Nao foi possivel executar o diagnostico de resposta.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
