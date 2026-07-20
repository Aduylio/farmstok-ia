import type {
  CreateKnowledgeSourceBody,
  KnowledgeIngestionResponse,
} from './knowledge-ingestion.schemas.js';
import type {
  KnowledgeIngestionRepository,
  KnowledgeSourceInput,
} from './knowledge-ingestion.repository.js';
import { DuplicateKnowledgeSourceError } from './knowledge-ingestion.repository.js';
import {
  createContentHash,
  estimateTokenCount,
} from './knowledge-ingestion.utils.js';
import { chunkTranscript } from './transcript-timestamps.js';

export interface PreparedKnowledgeChunk {
  content: string;
  contentHash: string;
  tokenCount: number;
  startTime: string | null;
  endTime: string | null;
}

export function prepareKnowledgeChunks(
  content: string,
): PreparedKnowledgeChunk[] {
  const uniqueChunks = new Map<string, PreparedKnowledgeChunk>();

  for (const chunk of chunkTranscript(content)) {
    const contentHash = createContentHash(chunk.content);

    if (!uniqueChunks.has(contentHash)) {
      uniqueChunks.set(contentHash, {
        ...chunk,
        contentHash,
        tokenCount: estimateTokenCount(chunk.content),
      });
    }
  }

  return [...uniqueChunks.values()];
}

function buildSourceInput(
  input: CreateKnowledgeSourceBody,
): KnowledgeSourceInput {
  return {
    sourceKey: input.sourceKey,
    type: input.type,
    title: input.title,
    course: input.course,
    ...(input.module === undefined ? {} : { module: input.module }),
    ...(input.lessonNumber === undefined
      ? {}
      : { lessonNumber: input.lessonNumber }),
    ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl }),
    ...(input.recordedAt === undefined
      ? {}
      : { recordedAt: new Date(input.recordedAt) }),
    ...(input.version === undefined ? {} : { version: input.version }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    ...(input.storagePath === undefined
      ? {}
      : { storagePath: input.storagePath }),
    ...(input.instructor === undefined
      ? {}
      : { instructor: input.instructor }),
  };
}

export class KnowledgeIngestionService {
  constructor(private readonly repository: KnowledgeIngestionRepository) {}

  async ingest(
    input: CreateKnowledgeSourceBody,
  ): Promise<KnowledgeIngestionResponse> {
    const existingSource = await this.repository.findSourceByKey(input.sourceKey);

    if (existingSource !== null) {
      throw new DuplicateKnowledgeSourceError();
    }

    const result = await this.repository.createSourceWithChunks({
      source: buildSourceInput(input),
      chunks: prepareKnowledgeChunks(input.content),
    });

    return {
      source: result.source,
      ingestion: {
        chunksCreated: result.chunksCreated,
        charactersProcessed: input.content.length,
      },
    };
  }
}
