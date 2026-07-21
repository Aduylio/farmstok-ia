import { env } from "../src/config/env.js";
import { prisma } from "../src/config/prisma.js";
import { OpenAIEmbeddingProvider } from "../src/modules/knowledge-ingestion/openai-embedding.provider.js";
import { KnowledgeHybridSearchService } from "../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.service.js";
import { PrismaKnowledgeSearchRepository } from "../src/modules/knowledge/knowledge-search.repository.js";
import { KnowledgeSearchService } from "../src/modules/knowledge/knowledge-search.service.js";
import { PrismaKnowledgeVectorSearchRepository } from "../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js";
import {
  EmbeddingProviderUnavailableError,
  KnowledgeVectorSearchService,
} from "../src/modules/knowledge-vector-search/knowledge-vector-search.service.js";
import { parseRagEvaluationCliArgs } from "../src/modules/rag-evaluation/rag-evaluation.cli.js";
import { loadRagEvaluationCases } from "../src/modules/rag-evaluation/rag-evaluation.loader.js";
import {
  formatRagEvaluationReport,
  serializeRagEvaluationReports,
} from "../src/modules/rag-evaluation/rag-evaluation.reporter.js";
import { RagEvaluationService } from "../src/modules/rag-evaluation/rag-evaluation.service.js";
import type { EvaluationSearchResult } from "../src/modules/rag-evaluation/rag-evaluation.types.js";

try {
  const options = parseRagEvaluationCliArgs(process.argv.slice(2));
  let cases = await loadRagEvaluationCases(
    "SPECS/evaluations/knowledge-search-cases.json",
  );
  if (options.caseId !== undefined)
    cases = cases.filter((i) => i.id === options.caseId);
  if (options.category !== undefined)
    cases = cases.filter((i) => i.category === options.category);
  if (options.limit !== undefined) cases = cases.slice(0, options.limit);
  if (cases.length === 0) throw new Error("NO_CASES");
  const text = new KnowledgeSearchService(
    new PrismaKnowledgeSearchRepository(),
  );
  const vector = new KnowledgeVectorSearchService(
    new PrismaKnowledgeVectorSearchRepository(),
    () => {
      if (env.OPENAI_API_KEY === undefined)
        throw new EmbeddingProviderUnavailableError();
      return OpenAIEmbeddingProvider.fromApiKey(env.OPENAI_API_KEY, {
        maxRetries: env.EMBEDDING_MAX_RETRIES,
        retryBaseMs: env.EMBEDDING_RETRY_BASE_MS,
      });
    },
  );
  const hybrid = new KnowledgeHybridSearchService(text, vector);
  const mapText = (
    results: Array<{
      chunkId: string;
      content: string;
      source: { sourceKey: string; title: string; module: string | null };
    }>,
  ): EvaluationSearchResult[] =>
    results.map((i) => ({
      chunkId: i.chunkId,
      content: i.content,
      sourceKey: i.source.sourceKey,
      title: i.source.title,
      module: i.source.module,
    }));
  const evaluator = new RagEvaluationService({
    TEXT: {
      async search(question) {
        const response = await text.search({ q: question, limit: 5 });
        return { results: mapText(response.results), effectiveMode: "TEXT" };
      },
    },
    HYBRID: {
      async search(question) {
        const response = await hybrid.search({
          q: question,
          limit: 5,
          minSimilarity: 0,
          textWeight: 0.4,
          vectorWeight: 0.6,
        });
        return {
          results: mapText(response.results),
          effectiveMode: response.mode,
        };
      },
    },
    VECTOR: {
      async search(question) {
        const response = await vector.search({
          q: question,
          limit: 5,
          minSimilarity: 0,
        });
        return {
          results: mapText(response.results),
          effectiveMode: "VECTOR",
          unavailable: response.reason === "NO_EMBEDDINGS_AVAILABLE",
        };
      },
    },
    ANSWER: {
      async search() {
        return {
          results: [],
          effectiveMode: "ANSWER_NOT_EXECUTED",
          unavailable: true,
        };
      },
    },
  });
  const [counts] = await prisma.$queryRaw<
    Array<{ sources: bigint; chunks: bigint }>
  >`SELECT (SELECT COUNT(*) FROM "knowledge_sources") AS "sources",(SELECT COUNT(*) FROM "knowledge_chunks") AS "chunks"`;
  const reports = [];
  for (const mode of options.modes)
    reports.push(
      await evaluator.evaluate(cases, mode, {
        date: "2026-07-21",
        sources: Number(counts?.sources ?? 0),
        chunks: Number(counts?.chunks ?? 0),
        configuration:
          mode === "TEXT"
            ? {
                candidateLimit: 500,
                resultLimit: 5,
                rankingPolicy: "text-search-v1",
              }
            : mode === "HYBRID"
              ? {
                  candidateMultiplier: 4,
                  textWeight: 0.4,
                  vectorWeight: 0.6,
                  resultLimit: 5,
                }
              : { resultLimit: 5 },
      }),
    );
  if (options.json)
    process.stdout.write(serializeRagEvaluationReports(reports));
  else console.log(reports.map(formatRagEvaluationReport).join("\n\n"));
} catch {
  console.error("Nao foi possivel executar a avaliacao RAG.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
