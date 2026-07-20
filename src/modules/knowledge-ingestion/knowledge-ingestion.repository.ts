import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';

import type { CreateKnowledgeSourceBody } from './knowledge-ingestion.schemas.js';

type KnowledgeSourceType = CreateKnowledgeSourceBody['type'];

export interface KnowledgeSourceRecord {
  id: string;
  type: KnowledgeSourceType;
  title: string;
  course: string;
}

export interface KnowledgeChunkInput {
  content: string;
  contentHash: string;
  tokenCount: number;
  startTime: string | null;
  endTime: string | null;
}

export interface KnowledgeSourceInput {
  type: KnowledgeSourceType;
  title: string;
  course: string;
  module?: string;
  lessonNumber?: number;
  sourceUrl?: string;
  recordedAt?: Date;
  version?: number;
  priority?: number;
  isActive?: boolean;
  storagePath?: string;
  instructor?: string;
}

export interface CreateSourceWithChunksInput {
  source: KnowledgeSourceInput;
  chunks: KnowledgeChunkInput[];
}

export interface CreateSourceWithChunksResult {
  source: KnowledgeSourceRecord;
  chunksCreated: number;
}

export interface KnowledgeIngestionRepository {
  createSourceWithChunks(
    input: CreateSourceWithChunksInput,
  ): Promise<CreateSourceWithChunksResult>;
}

export class DuplicateKnowledgeChunkError extends Error {
  constructor() {
    super('Um ou mais chunks já existem nesta fonte.');
    this.name = 'DuplicateKnowledgeChunkError';
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export class PrismaKnowledgeIngestionRepository
  implements KnowledgeIngestionRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async createSourceWithChunks(
    input: CreateSourceWithChunksInput,
  ): Promise<CreateSourceWithChunksResult> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const source = await transaction.knowledgeSource.create({
          data: input.source,
          select: {
            id: true,
            type: true,
            title: true,
            course: true,
          },
        });

        const createdChunks = await transaction.knowledgeChunk.createMany({
          data: input.chunks.map((chunk) => ({
            sourceId: source.id,
            content: chunk.content,
            contentHash: chunk.contentHash,
            tokenCount: chunk.tokenCount,
            startTime: chunk.startTime,
            endTime: chunk.endTime,
          })),
        });

        return {
          source,
          chunksCreated: createdChunks.count,
        };
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateKnowledgeChunkError();
      }

      throw error;
    }
  }
}
