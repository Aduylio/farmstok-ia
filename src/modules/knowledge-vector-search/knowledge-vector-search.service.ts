import { InvalidEmbeddingVectorError, validateEmbeddingVector } from '../../lib/vector.js';
import type { EmbeddingProvider } from '../knowledge-ingestion/embedding-provider.js';
import { EmbeddingProviderError } from '../knowledge-ingestion/embedding-provider.js';
import { buildTimestampUrl } from '../knowledge/knowledge-search.utils.js';
import type { KnowledgeVectorSearchQuery } from './knowledge-vector-search.schemas.js';
import type { KnowledgeVectorSearchRepository } from './knowledge-vector-search.repository.js';
import type { VectorSearchResponse } from './knowledge-vector-search.types.js';
import { buildQueryEmbeddingInput } from './knowledge-vector-search.utils.js';

export class EmbeddingProviderUnavailableError extends Error {}

export type EmbeddingProviderFactory = () => EmbeddingProvider;

export class KnowledgeVectorSearchService {
  constructor(
    private readonly repository: KnowledgeVectorSearchRepository,
    private readonly providerFactory: EmbeddingProviderFactory,
  ) {}

  async search(input: KnowledgeVectorSearchQuery): Promise<VectorSearchResponse> {
    if (await this.repository.countCompatibleEmbeddings() === 0) {
      return { query: input.q, results: [], total: 0, reason: 'NO_EMBEDDINGS_AVAILABLE' };
    }

    try {
      const queryInput = buildQueryEmbeddingInput(input.q);
      const batch = await this.providerFactory().embed([queryInput]);
      const item = batch.items[0];
      if (batch.items.length !== 1 || item === undefined) throw new EmbeddingProviderUnavailableError();
      const vector = validateEmbeddingVector(item.embedding);
      const rows = await this.repository.search(vector, {
        limit: input.limit,
        minSimilarity: input.minSimilarity,
        ...(input.sourceKey === undefined ? {} : { sourceKey: input.sourceKey }),
        ...(input.course === undefined ? {} : { course: input.course }),
        ...(input.type === undefined ? {} : { type: input.type }),
      });
      const results = rows.map((row) => ({
        chunkId: row.chunkId,
        content: row.content,
        similarity: Number(row.similarity),
        startTime: row.startTime,
        endTime: row.endTime,
        source: {
          id: row.sourceId,
          sourceKey: row.sourceKey,
          type: row.sourceType,
          title: row.title,
          course: row.course,
          module: row.module,
          sourceUrl: row.sourceUrl,
          timestampUrl: buildTimestampUrl(row.sourceUrl, row.startTime),
        },
      }));
      return { query: input.q, results, total: results.length, reason: results.length === 0 ? 'NO_RELEVANT_RESULTS' : null };
    } catch (error) {
      if (error instanceof EmbeddingProviderError || error instanceof EmbeddingProviderUnavailableError || error instanceof InvalidEmbeddingVectorError) {
        throw new EmbeddingProviderUnavailableError();
      }
      throw error;
    }
  }
}
