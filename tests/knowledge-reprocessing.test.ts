import type { PrismaClient } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import {
  KnowledgeReprocessingService,
  PrismaKnowledgeReprocessingRepository,
  type KnowledgeReprocessingRepository,
} from '../src/modules/knowledge-ingestion/knowledge-reprocessing.js';

describe('reprocessamento de conhecimento', () => {
  it('gera chunks temporais e reutiliza o sourceId existente', async () => {
    const calls: Array<{ sourceId: string; chunkCount: number }> = [];
    const repository: KnowledgeReprocessingRepository = {
      async replaceSourceChunks(sourceId, chunks) {
        calls.push({ sourceId, chunkCount: chunks.length });
        return {
          sourceId,
          chunksRemoved: 3,
          chunksCreated: chunks.length,
        };
      },
    };
    const service = new KnowledgeReprocessingService(repository);
    const sourceId = '3e1e04ad-32e5-4eed-b131-e72f16f063b7';

    const result = await service.reprocess(
      sourceId,
      '0:14\nTrecho inicial.\n0:30\nTrecho seguinte.',
    );

    expect(calls).toEqual([{ sourceId, chunkCount: 1 }]);
    expect(result).toEqual({
      sourceId,
      chunksRemoved: 3,
      chunksCreated: 1,
    });
  });

  it('substitui chunks na mesma transacao', async () => {
    const sourceId = '3e1e04ad-32e5-4eed-b131-e72f16f063b7';
    const transaction = {
      knowledgeSource: {
        findUnique: vi.fn(async () => ({ id: sourceId })),
      },
      knowledgeChunk: {
        deleteMany: vi.fn(async () => ({ count: 125 })),
        createMany: vi.fn(async () => ({ count: 80 })),
      },
    };
    const fakeClient = {
      $transaction: vi.fn(
        async (
          operation: (value: typeof transaction) => Promise<unknown>,
        ) => operation(transaction),
      ),
    } as unknown as PrismaClient;
    const repository = new PrismaKnowledgeReprocessingRepository(fakeClient);

    const result = await repository.replaceSourceChunks(sourceId, [
      {
        content: 'Trecho',
        contentHash: 'hash',
        tokenCount: 2,
        startTime: '00:00:14',
        endTime: null,
      },
    ]);

    expect(result).toEqual({
      sourceId,
      chunksRemoved: 125,
      chunksCreated: 80,
    });
    expect(transaction.knowledgeChunk.deleteMany).toHaveBeenCalledBefore(
      transaction.knowledgeChunk.createMany,
    );
    expect(fakeClient.$transaction).toHaveBeenCalledOnce();
  });

  it('faz rollback completo quando a criacao dos novos chunks falha', async () => {
    const sourceId = '3e1e04ad-32e5-4eed-b131-e72f16f063b7';
    const persistedChunks = ['chunk-antigo'];
    const transaction = {
      knowledgeSource: {
        findUnique: vi.fn(async () => ({ id: sourceId })),
      },
      knowledgeChunk: {
        deleteMany: vi.fn(async () => {
          persistedChunks.length = 0;
          return { count: 1 };
        }),
        createMany: vi.fn(async () => {
          throw new Error('falha simulada');
        }),
      },
    };
    const fakeClient = {
      $transaction: vi.fn(
        async (
          operation: (value: typeof transaction) => Promise<unknown>,
        ) => {
          const snapshot = [...persistedChunks];

          try {
            return await operation(transaction);
          } catch (error) {
            persistedChunks.splice(0, persistedChunks.length, ...snapshot);
            throw error;
          }
        },
      ),
    } as unknown as PrismaClient;
    const repository = new PrismaKnowledgeReprocessingRepository(fakeClient);

    await expect(
      repository.replaceSourceChunks(sourceId, [
        {
          content: 'Novo trecho',
          contentHash: 'novo-hash',
          tokenCount: 3,
          startTime: '00:00:14',
          endTime: null,
        },
      ]),
    ).rejects.toThrow('falha simulada');

    expect(persistedChunks).toEqual(['chunk-antigo']);
  });
});
