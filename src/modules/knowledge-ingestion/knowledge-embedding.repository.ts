import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';
import { embeddingConfig } from '../../config/embedding.js';
import { serializeEmbeddingVector } from '../../lib/vector.js';

interface CountRow {
  count: bigint | number | string;
}

export interface VectorSqlExecutor {
  execute(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<number>;
  query<T>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<T[]>;
}

class PrismaVectorSqlExecutor implements VectorSqlExecutor {
  constructor(private readonly client: PrismaClient) {}

  execute(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<number> {
    return this.client.$executeRaw(strings, ...values);
  }

  query<T>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<T[]> {
    return this.client.$queryRaw<T[]>(strings, ...values);
  }
}

export interface UpsertEmbeddingInput {
  chunkId: string;
  embedding: unknown;
  inputHash: string;
  inputTokens?: number;
  embeddedAt: Date;
}

function countFromRows(rows: CountRow[]): number {
  const first = rows[0];
  return first === undefined ? 0 : Number(first.count);
}

export class KnowledgeEmbeddingRepository {
  private readonly executor: VectorSqlExecutor;

  constructor(executor: VectorSqlExecutor = new PrismaVectorSqlExecutor(prisma)) {
    this.executor = executor;
  }

  async upsertEmbedding(input: UpsertEmbeddingInput): Promise<void> {
    const serializedEmbedding = serializeEmbeddingVector(input.embedding);
    const inputTokens = input.inputTokens ?? null;

    await this.executor.execute`
      INSERT INTO "knowledge_chunk_embeddings" (
        "chunk_id", "embedding", "provider", "model", "dimensions",
        "input_hash", "input_tokens", "embedded_at", "created_at", "updated_at"
      ) VALUES (
        ${input.chunkId}::uuid,
        ${serializedEmbedding}::vector,
        ${embeddingConfig.provider},
        ${embeddingConfig.model},
        ${embeddingConfig.dimensions},
        ${input.inputHash},
        ${inputTokens},
        ${input.embeddedAt},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("chunk_id") DO UPDATE SET
        "embedding" = EXCLUDED."embedding",
        "provider" = EXCLUDED."provider",
        "model" = EXCLUDED."model",
        "dimensions" = EXCLUDED."dimensions",
        "input_hash" = EXCLUDED."input_hash",
        "input_tokens" = EXCLUDED."input_tokens",
        "embedded_at" = EXCLUDED."embedded_at",
        "updated_at" = CURRENT_TIMESTAMP
    `;
  }

  async deleteEmbeddingByChunkId(chunkId: string): Promise<void> {
    await this.executor.execute`
      DELETE FROM "knowledge_chunk_embeddings"
      WHERE "chunk_id" = ${chunkId}::uuid
    `;
  }

  async countEmbeddings(): Promise<number> {
    const rows = await this.executor.query<CountRow>`
      SELECT COUNT(*) AS "count"
      FROM "knowledge_chunk_embeddings"
    `;
    return countFromRows(rows);
  }

  async countChunksWithoutEmbedding(): Promise<number> {
    const rows = await this.executor.query<CountRow>`
      SELECT COUNT(*) AS "count"
      FROM "knowledge_chunks" AS chunks
      LEFT JOIN "knowledge_chunk_embeddings" AS embeddings
        ON embeddings."chunk_id" = chunks."id"
      WHERE embeddings."chunk_id" IS NULL
    `;
    return countFromRows(rows);
  }
}
