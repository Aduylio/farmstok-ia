import { describe, expect, it } from 'vitest';

import { EMBEDDING_DIMENSIONS } from '../src/config/embedding.js';
import {
  KnowledgeEmbeddingRepository,
  type VectorSqlExecutor,
} from '../src/modules/knowledge-ingestion/knowledge-embedding.repository.js';

interface RecordedCall {
  sql: string;
  values: readonly unknown[];
}

class RecordingExecutor implements VectorSqlExecutor {
  readonly executions: RecordedCall[] = [];
  readonly queries: RecordedCall[] = [];
  queryResults: unknown[][] = [];

  async execute(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<number> {
    this.executions.push({ sql: strings.join('?'), values });
    return 1;
  }

  async query<T>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<T[]> {
    this.queries.push({ sql: strings.join('?'), values });
    return (this.queryResults.shift() ?? []) as T[];
  }
}

function validVector(): number[] {
  return new Array<number>(EMBEDDING_DIMENSIONS).fill(0.25);
}

describe('KnowledgeEmbeddingRepository', () => {
  it('faz upsert parametrizado e mantém metadados confirmados', async () => {
    const executor = new RecordingExecutor();
    const repository = new KnowledgeEmbeddingRepository(executor);
    const embeddedAt = new Date('2026-07-20T15:00:00.000Z');

    await repository.upsertEmbedding({
      chunkId: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
      embedding: validVector(),
      inputHash: 'a'.repeat(64),
      inputTokens: 120,
      embeddedAt,
    });

    const call = executor.executions[0];
    expect(call?.sql).toContain('ON CONFLICT');
    expect(call?.sql).toContain('?::vector');
    expect(call?.sql).not.toContain('[0.25,0.25');
    expect(call?.values).toContain('openai');
    expect(call?.values).toContain('text-embedding-3-small');
    expect(call?.values).toContain(1536);
    expect(call?.values).toContain('a'.repeat(64));
    expect(call?.values).toContain(120);
    expect(call?.values).toContain(embeddedAt);
  });

  it('valida o vetor antes de executar SQL', async () => {
    const executor = new RecordingExecutor();
    const repository = new KnowledgeEmbeddingRepository(executor);

    await expect(
      repository.upsertEmbedding({
        chunkId: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
        embedding: [1, 2],
        inputHash: 'a'.repeat(64),
        embeddedAt: new Date(),
      }),
    ).rejects.toThrow('vetor de embedding é inválido');
    expect(executor.executions).toHaveLength(0);
  });

  it('remove por chunkId com parâmetro', async () => {
    const executor = new RecordingExecutor();
    const repository = new KnowledgeEmbeddingRepository(executor);
    const chunkId = '3e1e04ad-32e5-4eed-b131-e72f16f063b7';

    await repository.deleteEmbeddingByChunkId(chunkId);

    expect(executor.executions[0]?.sql).toContain('WHERE "chunk_id" = ?::uuid');
    expect(executor.executions[0]?.values).toEqual([chunkId]);
  });

  it('conta embeddings', async () => {
    const executor = new RecordingExecutor();
    executor.queryResults = [[{ count: 7n }]];
    const repository = new KnowledgeEmbeddingRepository(executor);
    await expect(repository.countEmbeddings()).resolves.toBe(7);
  });

  it('conta chunks sem embedding', async () => {
    const executor = new RecordingExecutor();
    executor.queryResults = [[{ count: '148' }]];
    const repository = new KnowledgeEmbeddingRepository(executor);
    await expect(repository.countChunksWithoutEmbedding()).resolves.toBe(148);
    expect(executor.queries[0]?.sql).toContain('LEFT JOIN');
  });
});
