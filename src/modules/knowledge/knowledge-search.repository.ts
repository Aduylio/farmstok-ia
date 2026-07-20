import type { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from '../../config/prisma.js';

import type {
  KnowledgeSearchQuery,
  KnowledgeSourceType,
} from './knowledge-search.schemas.js';

export interface KnowledgeSearchCandidate {
  id: string;
  content: string;
  startTime: string | null;
  endTime: string | null;
  source: {
    id: string;
    sourceKey: string;
    type: KnowledgeSourceType;
    title: string;
    course: string;
    module: string | null;
    sourceUrl: string | null;
  };
}

export type KnowledgeSearchFilters = Pick<
  KnowledgeSearchQuery,
  'sourceKey' | 'course' | 'type'
>;

export interface KnowledgeSearchRepository {
  findCandidates(
    filters: KnowledgeSearchFilters,
    candidateLimit: number,
  ): Promise<KnowledgeSearchCandidate[]>;
}

export class PrismaKnowledgeSearchRepository
  implements KnowledgeSearchRepository
{
  constructor(private readonly client: PrismaClient = prisma) {}

  async findCandidates(
    filters: KnowledgeSearchFilters,
    candidateLimit: number,
  ): Promise<KnowledgeSearchCandidate[]> {
    return this.client.knowledgeChunk.findMany({
      where: {
        source: {
          is: {
            isActive: true,
            ...(filters.sourceKey === undefined
              ? {}
              : { sourceKey: filters.sourceKey }),
            ...(filters.course === undefined ? {} : { course: filters.course }),
            ...(filters.type === undefined ? {} : { type: filters.type }),
          },
        },
      },
      select: {
        id: true,
        content: true,
        startTime: true,
        endTime: true,
        source: {
          select: {
            id: true,
            sourceKey: true,
            type: true,
            title: true,
            course: true,
            module: true,
            sourceUrl: true,
          },
        },
      },
      orderBy: [{ source: { sourceKey: 'asc' } }, { startTime: 'asc' }, { id: 'asc' }],
      take: candidateLimit,
    });
  }
}
