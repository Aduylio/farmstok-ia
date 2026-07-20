import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';

import {
  prepareKnowledgeChunks,
  type PreparedKnowledgeChunk,
} from './knowledge-ingestion.service.js';

export interface KnowledgeReprocessingResult {
  sourceId: string;
  chunksRemoved: number;
  chunksCreated: number;
}

export interface KnowledgeReprocessingRepository {
  replaceSourceChunks(
    sourceId: string,
    chunks: PreparedKnowledgeChunk[],
  ): Promise<KnowledgeReprocessingResult>;
}

export class KnowledgeSourceNotFoundError extends Error {
  constructor(sourceId: string) {
    super(`Fonte ${sourceId} não encontrada.`);
    this.name = 'KnowledgeSourceNotFoundError';
  }
}

export class PrismaKnowledgeReprocessingRepository
  implements KnowledgeReprocessingRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async replaceSourceChunks(
    sourceId: string,
    chunks: PreparedKnowledgeChunk[],
  ): Promise<KnowledgeReprocessingResult> {
    return this.client.$transaction(async (transaction) => {
      const source = await transaction.knowledgeSource.findUnique({
        where: { id: sourceId },
        select: { id: true },
      });

      if (source === null) {
        throw new KnowledgeSourceNotFoundError(sourceId);
      }

      const removed = await transaction.knowledgeChunk.deleteMany({
        where: { sourceId },
      });
      const created = await transaction.knowledgeChunk.createMany({
        data: chunks.map((chunk) => ({
          sourceId,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
        })),
      });

      return {
        sourceId,
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
      sourceId,
      prepareKnowledgeChunks(content),
    );
  }
}
