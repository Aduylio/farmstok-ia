import OpenAI from 'openai';

import { embeddingConfig } from '../../config/embedding.js';
import { validateEmbeddingVector } from '../../lib/vector.js';
import {
  EmbeddingProviderError,
  type EmbeddingBatchResult,
  type EmbeddingProvider,
} from './embedding-provider.js';

interface OpenAIEmbeddingData {
  index: number;
  embedding: unknown;
}

interface OpenAIEmbeddingResponse {
  data: OpenAIEmbeddingData[];
  usage?: { total_tokens?: number };
}

export interface OpenAIEmbeddingsClient {
  create(inputs: string[]): Promise<OpenAIEmbeddingResponse>;
}

export interface OpenAIEmbeddingProviderOptions {
  maxRetries: number;
  retryBaseMs: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readErrorField(error: unknown, field: string): unknown {
  return typeof error === 'object' && error !== null && field in error
    ? error[field as keyof typeof error]
    : undefined;
}

function mapOpenAIError(error: unknown): EmbeddingProviderError {
  const status = readErrorField(error, 'status');
  const name = readErrorField(error, 'name');

  if (status === 429) {
    return new EmbeddingProviderError('EMBEDDING_RATE_LIMITED', true);
  }

  if (
    status === 408 ||
    name === 'APIConnectionTimeoutError' ||
    name === 'APIConnectionError'
  ) {
    return new EmbeddingProviderError('EMBEDDING_TIMEOUT', true);
  }

  if (typeof status === 'number' && status >= 500) {
    return new EmbeddingProviderError('EMBEDDING_API_ERROR', true);
  }

  if (status === 401 || status === 403) {
    return new EmbeddingProviderError('EMBEDDING_CONFIGURATION_ERROR', false);
  }

  return new EmbeddingProviderError('EMBEDDING_API_ERROR', false);
}

function validateResponse(
  response: OpenAIEmbeddingResponse,
  expectedCount: number,
): EmbeddingBatchResult {
  if (response.data.length !== expectedCount) {
    throw new EmbeddingProviderError('EMBEDDING_INVALID_RESPONSE', false);
  }

  const ordered = [...response.data].sort((first, second) => first.index - second.index);

  if (ordered.some((item, index) => item.index !== index)) {
    throw new EmbeddingProviderError('EMBEDDING_INVALID_RESPONSE', false);
  }

  try {
    return {
      items: ordered.map((item) => ({
        embedding: validateEmbeddingVector(item.embedding),
      })),
      inputTokens: response.usage?.total_tokens ?? 0,
    };
  } catch (error) {
    if (error instanceof EmbeddingProviderError) throw error;
    throw new EmbeddingProviderError('EMBEDDING_INVALID_RESPONSE', false);
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly client: OpenAIEmbeddingsClient,
    private readonly options: OpenAIEmbeddingProviderOptions,
  ) {
    this.sleep = options.sleep ?? defaultSleep;
  }

  static fromApiKey(
    apiKey: string,
    options: OpenAIEmbeddingProviderOptions,
  ): OpenAIEmbeddingProvider {
    const client = new OpenAI({
      apiKey,
      maxRetries: 0,
      timeout: 30_000,
      logLevel: 'off',
    });

    return new OpenAIEmbeddingProvider(
      {
        async create(inputs) {
          return client.embeddings.create({
            model: embeddingConfig.model,
            dimensions: embeddingConfig.dimensions,
            encoding_format: 'float',
            input: inputs,
          });
        },
      },
      options,
    );
  }

  async embed(inputs: string[]): Promise<EmbeddingBatchResult> {
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        return validateResponse(await this.client.create(inputs), inputs.length);
      } catch (error) {
        const mapped =
          error instanceof EmbeddingProviderError ? error : mapOpenAIError(error);

        if (!mapped.transient || attempt === this.options.maxRetries) throw mapped;

        await this.sleep(this.options.retryBaseMs * 2 ** attempt);
      }
    }

    throw new EmbeddingProviderError('EMBEDDING_API_ERROR', false);
  }
}
