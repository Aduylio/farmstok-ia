import type { PrismaClient } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import {
  DuplicateKnowledgeSourceError,
  PrismaKnowledgeIngestionRepository,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.repository.js';

describe('PrismaKnowledgeIngestionRepository', () => {
  it('reverte a transacao quando a criacao dos chunks falha', async () => {
    const stagedSources: string[] = [];
    let committed = false;

    const transaction = {
      knowledgeSource: {
        create: vi.fn(async () => {
          stagedSources.push('source-id');
          return {
            id: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
            sourceKey: 'aula:curva-abc',
            type: 'AULA' as const,
            title: 'Curva ABC',
            course: 'Farmstok',
          };
        }),
      },
      knowledgeChunk: {
        createMany: vi.fn(async () => {
          throw new Error('Falha simulada ao criar chunks');
        }),
      },
    };

    const fakeClient = {
      $transaction: vi.fn(
        async (
          operation: (value: typeof transaction) => Promise<unknown>,
        ): Promise<unknown> => {
          try {
            const result = await operation(transaction);
            committed = true;
            return result;
          } catch (error) {
            stagedSources.length = 0;
            throw error;
          }
        },
      ),
    } as unknown as PrismaClient;

    const repository = new PrismaKnowledgeIngestionRepository(fakeClient);

    await expect(
      repository.createSourceWithChunks({
        source: {
          sourceKey: 'aula:curva-abc',
          type: 'AULA',
          title: 'Curva ABC',
          course: 'Farmstok',
        },
        chunks: [
          {
            content: 'Conteúdo',
            contentHash: 'hash',
            tokenCount: 2,
            startTime: null,
            endTime: null,
          },
        ],
      }),
    ).rejects.toThrow('Falha simulada ao criar chunks');

    expect(committed).toBe(false);
    expect(stagedSources).toHaveLength(0);
    expect(fakeClient.$transaction).toHaveBeenCalledOnce();
  });

  it('mapeia conflito unico da sourceKey e nao cria chunks', async () => {
    const transaction = {
      knowledgeSource: {
        create: vi.fn(async () => {
          throw { code: 'P2002' };
        }),
      },
      knowledgeChunk: { createMany: vi.fn() },
    };
    const fakeClient = {
      $transaction: vi.fn(async (operation: (value: typeof transaction) => Promise<unknown>) =>
        operation(transaction)),
    } as unknown as PrismaClient;
    const repository = new PrismaKnowledgeIngestionRepository(fakeClient);

    await expect(repository.createSourceWithChunks({
      source: {
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
      },
      chunks: [],
    })).rejects.toBeInstanceOf(DuplicateKnowledgeSourceError);

    expect(transaction.knowledgeChunk.createMany).not.toHaveBeenCalled();
  });
});
