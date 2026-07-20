import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';

import {
  prepareKnowledgeChunks,
  type PreparedKnowledgeChunk,
} from './knowledge-ingestion.service.js';

export interface KnowledgeReprocessingResult {
  sourceId: string;
  sourceKey: string;
  chunksRemoved: number;
  chunksCreated: number;
}

export interface KnowledgeReprocessingRepository {
  replaceSourceChunks(
    selector: { id: string } | { sourceKey: string },
    chunks: PreparedKnowledgeChunk[],
  ): Promise<KnowledgeReprocessingResult>;
}

export class KnowledgeSourceNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Fonte ${identifier} não encontrada.`);
    this.name = 'KnowledgeSourceNotFoundError';
  }
}

export class PrismaKnowledgeReprocessingRepository
  implements KnowledgeReprocessingRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async replaceSourceChunks(
    selector: { id: string } | { sourceKey: string },
    chunks: PreparedKnowledgeChunk[],
  ): Promise<KnowledgeReprocessingResult> {
    return this.client.$transaction(async (transaction) => {
      const source = await transaction.knowledgeSource.findUnique({
        where: selector,
        select: { id: true, sourceKey: true },
      });

      if (source === null) {
        throw new KnowledgeSourceNotFoundError(
          'id' in selector ? selector.id : selector.sourceKey,
        );
      }

      const removed = await transaction.knowledgeChunk.deleteMany({
        where: { sourceId: source.id },
      });
      const created = await transaction.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          sourceId: source.id,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        })),
      });

      return {
        sourceId: source.id,
        sourceKey: source.sourceKey,
        chunksRemoved: removed.count,
        chunksCreated: created.count,
      };
    });
  }
}

export class KnowledgeReprocessingService {
  constructor(private readonly repository: KnowledgeReprocessingRepository) {}

  async reprocess(
    sourceId: string,
    content: string,
  ): Promise<KnowledgeReprocessingResult> {
    return this.repository.replaceSourceChunks(
      { id: sourceId },
      prepareKnowledgeChunks(content),
    );
  }

  async reprocessBySourceKey(
    sourceKey: string,
    content: string,
  ): Promise<KnowledgeReprocessingResult> {
    return this.repository.replaceSourceChunks(
      { sourceKey },
      prepareKnowledgeChunks(content),
    );
  }
}
