import type { HybridMode, HybridSearchResult } from '../knowledge-hybrid-search/knowledge-hybrid-search.types.js';

export interface KnowledgeAnswerSource { chunkId: string; sourceKey: string; title: string; module: string | null; url: string | null; startTime: string | null; timestampUrl: string | null }
export interface KnowledgeAnswerResponse { answer: string; confidence: number; needsHuman: boolean; searchMode: HybridMode; sources: KnowledgeAnswerSource[] }
export interface KnowledgeAnswerContextResult { context: string; chunks: HybridSearchResult[]; omittedChunks: number }
