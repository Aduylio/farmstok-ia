export const HYBRID_CANDIDATE_MULTIPLIER = 4;
export const BOTH_MATCH_BONUS = 0.05;

export function normalizeWeights(textWeight: number, vectorWeight: number) {
  const total = textWeight + vectorWeight;
  if (total <= 0) throw new Error('INVALID_HYBRID_WEIGHTS');
  return { textWeight: textWeight / total, vectorWeight: vectorWeight / total };
}

export function normalizeTextScores(scores: number[]): number[] {
  const maximum = Math.max(0, ...scores);
  return maximum === 0 ? scores.map(() => 0) : scores.map((score) => Math.max(0, Math.min(1, score / maximum)));
}

export function hybridCandidateLimit(limit: number): number {
  return Math.min(20, limit * HYBRID_CANDIDATE_MULTIPLIER);
}

export function calculateHybridScore(text: number, vector: number, textWeight: number, vectorWeight: number, both: boolean): number {
  return Math.max(0, Math.min(1, text * textWeight + vector * vectorWeight + (both ? BOTH_MATCH_BONUS : 0)));
}
