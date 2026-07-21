import type { KnowledgeSearchQuery, KnowledgeSearchResponse, KnowledgeSourceType } from '../knowledge/knowledge-search.schemas.js';
import type { KnowledgeVectorSearchQuery } from '../knowledge-vector-search/knowledge-vector-search.schemas.js';
import type { VectorSearchResponse } from '../knowledge-vector-search/knowledge-vector-search.types.js';

export type HybridMatch = 'TEXT' | 'VECTOR';
export type HybridMode = 'HYBRID' | 'TEXT_ONLY' | 'VECTOR_ONLY';
export type HybridReason = 'VECTOR_UNAVAILABLE' | 'NO_RELEVANT_RESULTS' | null;

export interface HybridSearchInput {
  q: string; limit: number; minSimilarity: number; textWeight: number; vectorWeight: number;
  sourceKey?: string | undefined;
  course?: string | undefined;
  type?: KnowledgeSourceType | undefined;
}

export interface HybridSearchResult {
  chunkId: string; content: string; hybridScore: number; textScore: number;
  vectorScore: number; matchedBy: HybridMatch[]; startTime: string | null; endTime: string | null;
  source: KnowledgeSearchResponse['results'][number]['source'];
}

export interface HybridSearchResponse {
  query: string; results: HybridSearchResult[]; total: number; mode: HybridMode; reason: HybridReason;
}

export interface TextSearchService { search(input: KnowledgeSearchQuery): Promise<KnowledgeSearchResponse> }
export interface VectorSearchService { search(input: KnowledgeVectorSearchQuery): Promise<VectorSearchResponse> }
