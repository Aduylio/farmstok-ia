import { describe, expect, it, vi } from 'vitest';

import { EMBEDDING_DIMENSIONS } from '../src/config/embedding.js';
import { EmbeddingProviderError } from '../src/modules/knowledge-ingestion/embedding-provider.js';
import { OpenAIEmbeddingProvider, type OpenAIEmbeddingsClient } from '../src/modules/knowledge-ingestion/openai-embedding.provider.js';

const vector = () => new Array<number>(EMBEDDING_DIMENSIONS).fill(0.1);
const response = (count = 1) => ({ data: Array.from({ length: count }, (_, index) => ({ index, embedding: vector() })), usage: { total_tokens: 12 } });

describe('OpenAIEmbeddingProvider', () => {
  it('preserva ordem, valida vetores e registra tokens agregados', async () => {
    const client = { create: vi.fn().mockResolvedValue(response(2)) };
    const result = await new OpenAIEmbeddingProvider(client, { maxRetries: 0, retryBaseMs: 1 }).embed(['a', 'b']);
    expect(result.items).toHaveLength(2);
    expect(result.inputTokens).toBe(12);
    expect(client.create).toHaveBeenCalledWith(['a', 'b']);
  });
  it('rejeita quantidade ou Ã­ndices incorretos', async () => {
    const missing = new OpenAIEmbeddingProvider({ create: vi.fn().mockResolvedValue(response(1)) }, { maxRetries: 0, retryBaseMs: 1 });
    await expect(missing.embed(['a', 'b'])).rejects.toMatchObject({ code: 'EMBEDDING_INVALID_RESPONSE' });
    const order = new OpenAIEmbeddingProvider({ create: vi.fn().mockResolvedValue({ data: [{ index: 2, embedding: vector() }] }) }, { maxRetries: 0, retryBaseMs: 1 });
    await expect(order.embed(['a'])).rejects.toMatchObject({ code: 'EMBEDDING_INVALID_RESPONSE' });
  });
  it('rejeita vetor invÃ¡lido sem retry', async () => {
    const client = { create: vi.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1] }] }) };
    await expect(new OpenAIEmbeddingProvider(client, { maxRetries: 3, retryBaseMs: 1 }).embed(['a'])).rejects.toMatchObject({ code: 'EMBEDDING_INVALID_RESPONSE' });
    expect(client.create).toHaveBeenCalledTimes(1);
  });
  it.each([[429, 'EMBEDDING_RATE_LIMITED'], [500, 'EMBEDDING_API_ERROR'], [503, 'EMBEDDING_API_ERROR']] as const)('faz retry para HTTP %i', async (status, code) => {
    const client = { create: vi.fn().mockRejectedValueOnce({ status }).mockResolvedValue(response()) };
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(new OpenAIEmbeddingProvider(client, { maxRetries: 1, retryBaseMs: 25, sleep }).embed(['a'])).resolves.toBeDefined();
    expect(sleep).toHaveBeenCalledWith(25);
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(code).toBeTruthy();
  });
  it('faz retry em timeout com backoff exponencial injetÃ¡vel', async () => {
    const client = { create: vi.fn().mockRejectedValueOnce({ name: 'APIConnectionTimeoutError' }).mockRejectedValueOnce({ name: 'APIConnectionError' }).mockResolvedValue(response()) };
    const sleep = vi.fn().mockResolvedValue(undefined);
    await new OpenAIEmbeddingProvider(client, { maxRetries: 2, retryBaseMs: 10, sleep }).embed(['a']);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });
  it.each([400, 401, 403, 404])('nÃ£o repete erro HTTP %i', async (status) => {
    const client: OpenAIEmbeddingsClient = { create: vi.fn().mockRejectedValue({ status }) };
    const provider = new OpenAIEmbeddingProvider(client, { maxRetries: 3, retryBaseMs: 1, sleep: vi.fn() });
    await expect(provider.embed(['a'])).rejects.toBeInstanceOf(EmbeddingProviderError);
    expect(client.create).toHaveBeenCalledTimes(1);
  });
});
