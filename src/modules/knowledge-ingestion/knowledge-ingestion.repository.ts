import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';

import type { CreateKnowledgeSourceBody } from './knowledge-ingestion.schemas.js';

type KnowledgeSourceType = CreateKnowledgeSourceBody['type'];

export interface KnowledgeSourceRecord {
  id: string;
  sourceKey: string;
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
  sourceKey: string;
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
  findSourceByKey(sourceKey: string): Promise<{ id: string } | null>;
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

export class DuplicateKnowledgeSourceError extends Error {
  constructor() {
    super('Já existe uma fonte com esta sourceKey.');
    this.name = 'DuplicateKnowledgeSourceError';
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

  async findSourceByKey(sourceKey: string): Promise<{ id: string } | null> {
    return this.client.knowledgeSource.findUnique({
      where: { sourceKey },
      select: { id: true },
    });
  }

  async createSourceWithChunks(
    input: CreateSourceWithChunksInput,
  ): Promise<CreateSourceWithChunksResult> {
    try {
      return await this.client.$transaction(async (transaction) => {
        let source: KnowledgeSourceRecord;

        try {
          source = await transaction.knowledgeSource.create({
            data: input.source,
            select: {
              id: true,
              sourceKey: true,
              type: true,
              title: true,
              course: true,
            },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateKnowledgeSourceError();
          }

          throw error;
        }

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
