export interface EmbeddingResultItem {
  embedding: number[];
  inputTokens?: number;
}

export interface EmbeddingBatchResult {
  items: EmbeddingResultItem[];
  inputTokens: number;
}

export interface EmbeddingProvider {
  embed(inputs: string[]): Promise<EmbeddingBatchResult>;
}

export type EmbeddingErrorCode =
  | 'EMBEDDING_API_ERROR'
  | 'EMBEDDING_RATE_LIMITED'
  | 'EMBEDDING_TIMEOUT'
  | 'EMBEDDING_INVALID_RESPONSE'
  | 'EMBEDDING_CONFIGURATION_ERROR';

export class EmbeddingProviderError extends Error {
  constructor(
    readonly code: EmbeddingErrorCode,
    readonly transient: boolean,
  ) {
    super('Não foi possível gerar embeddings.');
    this.name = 'EmbeddingProviderError';
  }
}
