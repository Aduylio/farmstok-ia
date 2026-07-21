import type { HybridSearchInput, HybridSearchResponse, HybridSearchResult, TextSearchService, VectorSearchService } from './knowledge-hybrid-search.types.js';
import { calculateHybridScore, hybridCandidateLimit, normalizeTextScores, normalizeWeights } from './knowledge-hybrid-search.utils.js';

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function compareTime(a: string | null, b: string | null): number { if (a === b) return 0; if (a === null) return 1; if (b === null) return -1; return compareText(a, b); }

export class KnowledgeHybridSearchService {
  constructor(private readonly textService: TextSearchService, private readonly vectorService: VectorSearchService) {}

  async search(input: HybridSearchInput): Promise<HybridSearchResponse> {
    const candidateLimit = hybridCandidateLimit(input.limit);
    const shared = { q: input.q, limit: candidateLimit, ...(input.sourceKey === undefined ? {} : { sourceKey: input.sourceKey }), ...(input.course === undefined ? {} : { course: input.course }), ...(input.type === undefined ? {} : { type: input.type }) };
    const [text, vector] = await Promise.all([
      this.textService.search(shared),
      this.vectorService.search({ ...shared, minSimilarity: input.minSimilarity }),
    ]);
    const vectorUnavailable = vector.reason === 'NO_EMBEDDINGS_AVAILABLE';
    const normalizedScores = normalizeTextScores(text.results.map((item) => item.score));
    const weights = normalizeWeights(input.textWeight, input.vectorWeight);
    const merged = new Map<string, HybridSearchResult>();
    text.results.forEach((item, index) => merged.set(item.chunkId, { ...item, hybridScore: 0, textScore: normalizedScores[index] ?? 0, vectorScore: 0, matchedBy: ['TEXT'] }));
    if (!vectorUnavailable) {
      for (const item of vector.results) {
        const current = merged.get(item.chunkId);
        if (current !== undefined) { current.vectorScore = Math.max(0, Math.min(1, item.similarity)); current.matchedBy = ['TEXT', 'VECTOR']; }
        else merged.set(item.chunkId, { ...item, hybridScore: 0, textScore: 0, vectorScore: Math.max(0, Math.min(1, item.similarity)), matchedBy: ['VECTOR'] });
      }
    }
    const ranked = [...merged.values()].map((item) => ({ ...item, hybridScore: calculateHybridScore(item.textScore, item.vectorScore, weights.textWeight, weights.vectorWeight, item.matchedBy.length === 2) })).sort((a, b) => b.hybridScore - a.hybridScore || b.matchedBy.length - a.matchedBy.length || b.vectorScore - a.vectorScore || b.textScore - a.textScore || compareText(a.source.sourceKey, b.source.sourceKey) || compareTime(a.startTime, b.startTime) || compareText(a.chunkId, b.chunkId));
    const results = ranked.slice(0, input.limit);
    const mode = vectorUnavailable ? 'TEXT_ONLY' : text.results.length === 0 && vector.results.length > 0 ? 'VECTOR_ONLY' : 'HYBRID';
    const reason = results.length === 0 ? 'NO_RELEVANT_RESULTS' : vectorUnavailable ? 'VECTOR_UNAVAILABLE' : null;
    return { query: input.q, results, total: ranked.length, mode, reason };
  }
}
