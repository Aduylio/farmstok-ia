export const EMBEDDING_PROVIDER = 'openai';
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

export const embeddingConfig = {
  provider: EMBEDDING_PROVIDER,
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
} as const;
