import type { PrismaClient } from '../src/generated/prisma/client.js';
import { describe, expect, it, vi } from 'vitest';

import { PrismaKnowledgeSearchRepository } from '../src/modules/knowledge/knowledge-search.repository.js';

describe('PrismaKnowledgeSearchRepository', () => {
  it('filtra fonte ativa e filtros opcionais sem SQL concatenado', async () => {
    const findMany = vi.fn(async () => []);
    const client = {
      knowledgeChunk: { findMany },
    } as unknown as PrismaClient;
    const repository = new PrismaKnowledgeSearchRepository(client);

    await repository.findCandidates(
      {
        sourceKey: 'live:trier',
        course: 'Farmstok',
        type: 'LIVE',
      },
      500,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          source: {
            is: {
              isActive: true,
              sourceKey: 'live:trier',
              course: 'Farmstok',
              type: 'LIVE',
            },
          },
        },
        take: 500,
      }),
    );
  });
});
