import { prisma } from '../../config/prisma.js';
import { embeddingConfig } from '../../config/embedding.js';
import { serializeEmbeddingVector } from '../../lib/vector.js';
import type { VectorSearchFilters, VectorSearchRow } from './knowledge-vector-search.types.js';

interface CountRow { count: bigint | number | string }

export interface VectorSearchSqlExecutor {
  query<T>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<T[]>;
}

class PrismaVectorSearchSqlExecutor implements VectorSearchSqlExecutor {
  query<T>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<T[]> {
    return prisma.$queryRaw<T[]>(strings, ...values);
  }
}

export interface KnowledgeVectorSearchRepository {
  countCompatibleEmbeddings(): Promise<number>;
  search(vector: unknown, filters: VectorSearchFilters): Promise<VectorSearchRow[]>;
}

export class PrismaKnowledgeVectorSearchRepository implements KnowledgeVectorSearchRepository {
  constructor(private readonly executor: VectorSearchSqlExecutor = new PrismaVectorSearchSqlExecutor()) {}

  async countCompatibleEmbeddings(): Promise<number> {
    const rows = await this.executor.query<CountRow>`
      SELECT COUNT(*) AS "count"
      FROM "knowledge_chunk_embeddings" embeddings
      JOIN "knowledge_chunks" chunks ON chunks."id" = embeddings."chunk_id"
      JOIN "knowledge_sources" sources ON sources."id" = chunks."source_id"
      WHERE sources."is_active" = true
        AND embeddings."provider" = ${embeddingConfig.provider}
        AND embeddings."model" = ${embeddingConfig.model}
        AND embeddings."dimensions" = ${embeddingConfig.dimensions}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async search(vector: unknown, filters: VectorSearchFilters): Promise<VectorSearchRow[]> {
    const serialized = serializeEmbeddingVector(vector);
    const sourceKey = filters.sourceKey ?? null;
    const course = filters.course ?? null;
    const type = filters.type ?? null;
    return this.executor.query<VectorSearchRow>`
      SELECT chunks."id" AS "chunkId", chunks."content",
        1 - (embeddings."embedding" <=> ${serialized}::vector) AS "similarity",
        chunks."start_time" AS "startTime", chunks."end_time" AS "endTime",
        sources."id" AS "sourceId", sources."source_key" AS "sourceKey",
        sources."type"::text AS "sourceType", sources."title", sources."course",
        sources."module", sources."source_url" AS "sourceUrl"
      FROM "knowledge_chunk_embeddings" embeddings
      JOIN "knowledge_chunks" chunks ON chunks."id" = embeddings."chunk_id"
      JOIN "knowledge_sources" sources ON sources."id" = chunks."source_id"
      WHERE sources."is_active" = true
        AND embeddings."provider" = ${embeddingConfig.provider}
        AND embeddings."model" = ${embeddingConfig.model}
        AND embeddings."dimensions" = ${embeddingConfig.dimensions}
        AND (${sourceKey}::text IS NULL OR sources."source_key" = ${sourceKey})
        AND (${course}::text IS NULL OR sources."course" = ${course})
        AND (${type}::text IS NULL OR sources."type"::text = ${type})
        AND 1 - (embeddings."embedding" <=> ${serialized}::vector) >= ${filters.minSimilarity}
      ORDER BY "similarity" DESC, sources."source_key" ASC,
        chunks."start_time" ASC NULLS LAST, chunks."id" ASC
      LIMIT ${filters.limit}
    `;
  }
}
