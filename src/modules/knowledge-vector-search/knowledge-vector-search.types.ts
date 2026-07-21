import type { KnowledgeSourceType } from '../knowledge/knowledge-search.schemas.js';

export type VectorSearchReason =
  | 'NO_EMBEDDINGS_AVAILABLE'
  | 'NO_RELEVANT_RESULTS'
  | null;

export interface VectorSearchFilters {
  sourceKey?: string;
  course?: string;
  type?: KnowledgeSourceType;
  minSimilarity: number;
  limit: number;
}

export interface VectorSearchRow {
  chunkId: string;
  content: string;
  similarity: number;
  startTime: string | null;
  endTime: string | null;
  sourceId: string;
  sourceKey: string;
  sourceType: KnowledgeSourceType;
  title: string;
  course: string;
  module: string | null;
  sourceUrl: string | null;
}

export interface VectorSearchResult {
  chunkId: string;
  content: string;
  similarity: number;
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
    timestampUrl: string | null;
  };
}

export interface VectorSearchResponse {
  query: string;
  results: VectorSearchResult[];
  total: number;
  reason: VectorSearchReason;
}
