export const queryEmbeddingInputVersion = 'v1';

export function buildQueryEmbeddingInput(query: string): string {
  const normalized = query.replace(/\r\n?/gu, '\n').trim();
  if (normalized.length === 0) throw new Error('INVALID_QUERY_EMBEDDING_INPUT');
  return normalized;
}
