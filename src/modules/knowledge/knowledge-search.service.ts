import type {
  KnowledgeSearchQuery,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
} from './knowledge-search.schemas.js';
import type {
  KnowledgeSearchCandidate,
  KnowledgeSearchRepository,
} from './knowledge-search.repository.js';
import {
  buildTimestampUrl,
  calculateTextSearchScore,
  tokenizeSearchQuery,
} from './knowledge-search.utils.js';

export const KNOWLEDGE_SEARCH_CANDIDATE_LIMIT = 500;

function compareStrings(first: string, second: string): number {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

function compareNullableTimestamps(
  first: string | null,
  second: string | null,
): number {
  if (first === second) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return compareStrings(first, second);
}

function rankCandidate(
  candidate: KnowledgeSearchCandidate,
  query: string,
  terms: string[],
): KnowledgeSearchResult | null {
  const score = calculateTextSearchScore({
    query,
    terms,
    title: candidate.source.title,
    module: candidate.source.module,
    content: candidate.content,
  });

  if (score === 0) return null;

  return {
    chunkId: candidate.id,
    content: candidate.content,
    score,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    source: {
      ...candidate.source,
      timestampUrl: buildTimestampUrl(
        candidate.source.sourceUrl,
        candidate.startTime,
      ),
    },
  };
}

export class KnowledgeSearchService {
  constructor(private readonly repository: KnowledgeSearchRepository) {}

  async search(input: KnowledgeSearchQuery): Promise<KnowledgeSearchResponse> {
    const terms = tokenizeSearchQuery(input.q);
    const candidates = await this.repository.findCandidates(
      {
        sourceKey: input.sourceKey,
        course: input.course,
        type: input.type,
      },
      KNOWLEDGE_SEARCH_CANDIDATE_LIMIT,
    );
    const rankedResults = candidates
      .map((candidate) => rankCandidate(candidate, input.q, terms))
      .filter((result): result is KnowledgeSearchResult => result !== null)
      .sort(
        (first, second) =>
          second.score - first.score ||
          compareStrings(first.source.sourceKey, second.source.sourceKey) ||
          compareNullableTimestamps(first.startTime, second.startTime) ||
          compareStrings(first.chunkId, second.chunkId),
      );

    return {
      query: input.q,
      results: rankedResults.slice(0, input.limit),
      total: rankedResults.length,
    };
  }
}
