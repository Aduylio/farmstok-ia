import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import type { EmbeddingProvider } from '../src/modules/knowledge-ingestion/embedding-provider.js';
import { EmbeddingProviderError } from '../src/modules/knowledge-ingestion/embedding-provider.js';
import { parseVectorSearchCliArgs } from '../src/modules/knowledge-vector-search/knowledge-vector-search.cli.js';
import { knowledgeVectorSearchQuerySchema } from '../src/modules/knowledge-vector-search/knowledge-vector-search.schemas.js';
import type { KnowledgeVectorSearchRepository, VectorSearchSqlExecutor } from '../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js';
import { PrismaKnowledgeVectorSearchRepository } from '../src/modules/knowledge-vector-search/knowledge-vector-search.repository.js';
import { createKnowledgeVectorSearchRoutes } from '../src/modules/knowledge-vector-search/knowledge-vector-search.routes.js';
import { EmbeddingProviderUnavailableError, KnowledgeVectorSearchService } from '../src/modules/knowledge-vector-search/knowledge-vector-search.service.js';
import type { VectorSearchRow } from '../src/modules/knowledge-vector-search/knowledge-vector-search.types.js';
import { buildQueryEmbeddingInput, queryEmbeddingInputVersion } from '../src/modules/knowledge-vector-search/knowledge-vector-search.utils.js';
import { validEmbeddingVector } from './helpers/embedding-vector.js';

const query = { q: 'estoque minimo', limit: 5, minSimilarity: 0 };
const row: VectorSearchRow = {
  chunkId: 'chunk-1', content: 'Conteudo', similarity: 0.87,
  startTime: '00:32:18', endTime: '00:33:04', sourceId: 'source-1',
  sourceKey: 'live:a', sourceType: 'LIVE', title: 'Live', course: 'Farmstok',
  module: null, sourceUrl: 'https://www.youtube.com/watch?v=abc',
};

function fakeRepository(count: number, rows: VectorSearchRow[] = [row]): KnowledgeVectorSearchRepository & { search: ReturnType<typeof vi.fn> } {
  return { countCompatibleEmbeddings: vi.fn().mockResolvedValue(count), search: vi.fn().mockResolvedValue(rows) };
}
function fakeProvider(vector = validEmbeddingVector()): EmbeddingProvider & { embed: ReturnType<typeof vi.fn> } {
  return { embed: vi.fn().mockResolvedValue({ items: [{ embedding: vector }], inputTokens: 3 }) };
}

describe('query embedding input v1', () => {
  it('normaliza quebra, trim e preserva palavras e acentos', () => {
    expect(queryEmbeddingInputVersion).toBe('v1');
    expect(buildQueryEmbeddingInput('  gestÃ£o\r\nde estoque  ')).toBe('gestÃ£o\nde estoque');
  });
  it('rejeita vazio', () => expect(() => buildQueryEmbeddingInput(' \r\n ')).toThrow());
});

describe('schema da busca vetorial', () => {
  it('aplica defaults', () => expect(knowledgeVectorSearchQuerySchema.parse({ q: 'abc' })).toMatchObject({ limit: 5, minSimilarity: 0 }));
  it('aceita similaridade valida', () => expect(knowledgeVectorSearchQuerySchema.safeParse({ q: 'a', minSimilarity: '0.8' }).success).toBe(true));
  it.each([{ q: '' }, { q: 'a'.repeat(501) }, { q: 'a', limit: 0 }, { q: 'a', limit: 21 }, { q: 'a', minSimilarity: -0.1 }, { q: 'a', minSimilarity: 1.1 }])('rejeita entrada invalida %#', (input) => expect(knowledgeVectorSearchQuerySchema.safeParse(input).success).toBe(false));
});

describe('service vetorial', () => {
  it('zero embeddings nao cria nem chama provider', async () => {
    const repository = fakeRepository(0); const factory = vi.fn();
    const result = await new KnowledgeVectorSearchService(repository, factory).search(query);
    expect(result.reason).toBe('NO_EMBEDDINGS_AVAILABLE'); expect(factory).not.toHaveBeenCalled(); expect(repository.search).not.toHaveBeenCalled();
  });
  it('com embeddings chama provider somente com a pergunta e monta timestamp', async () => {
    const repository = fakeRepository(1); const provider = fakeProvider();
    const result = await new KnowledgeVectorSearchService(repository, () => provider).search({ ...query, q: '  gestÃ£o  ', sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: 0.5, limit: 3 });
    expect(provider.embed).toHaveBeenCalledWith(['gestÃ£o']);
    expect(repository.search).toHaveBeenCalledWith(expect.any(Array), { sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: 0.5, limit: 3 });
    expect(result.results[0]?.source.timestampUrl).toContain('t=1938s'); expect(result.reason).toBeNull();
  });
  it('retorna sem URL temporal para fonte externa ou sem horario', async () => {
    const repository = fakeRepository(1, [{ ...row, startTime: null, sourceUrl: 'https://example.com' }]);
    const result = await new KnowledgeVectorSearchService(repository, () => fakeProvider()).search(query);
    expect(result.results[0]?.source.timestampUrl).toBeNull();
  });
  it('rejeita vetor invalido e sanitiza erro do provider', async () => {
    const repository = fakeRepository(1);
    await expect(new KnowledgeVectorSearchService(repository, () => fakeProvider([1])).search(query)).rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
    const provider = { embed: vi.fn().mockRejectedValue(new EmbeddingProviderError('EMBEDDING_RATE_LIMITED', true)) };
    await expect(new KnowledgeVectorSearchService(repository, () => provider).search(query)).rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
  });
  it('retorna NO_RELEVANT_RESULTS', async () => {
    const result = await new KnowledgeVectorSearchService(fakeRepository(1, []), () => fakeProvider()).search(query);
    expect(result).toMatchObject({ total: 0, reason: 'NO_RELEVANT_RESULTS' });
  });
});

class RecordingExecutor implements VectorSearchSqlExecutor {
  calls: { sql: string; values: readonly unknown[] }[] = [];
  results: unknown[][] = [];
  async query<T>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<T[]> {
    this.calls.push({ sql: strings.join('?'), values }); return (this.results.shift() ?? []) as T[];
  }
}

describe('repository vetorial', () => {
  it('conta somente embeddings ativos e compativeis', async () => {
    const executor = new RecordingExecutor(); executor.results = [[{ count: 2n }]];
    await expect(new PrismaKnowledgeVectorSearchRepository(executor).countCompatibleEmbeddings()).resolves.toBe(2);
    const call = executor.calls[0]!; expect(call.sql).toContain('sources."is_active" = true'); expect(call.values).toEqual(['openai', 'text-embedding-3-small', 1536]);
  });
  it('usa cosseno parametrizado, filtros, limite e ordem deterministica', async () => {
    const executor = new RecordingExecutor(); executor.results = [[]];
    await new PrismaKnowledgeVectorSearchRepository(executor).search(validEmbeddingVector(), { sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: 0.7, limit: 4 });
    const call = executor.calls[0]!;
    expect(call.sql).toContain('1 - (embeddings."embedding" <=> ?::vector)');
    expect(call.sql).toContain('sources."is_active" = true');
    expect(call.sql).toContain('ORDER BY "similarity" DESC'); expect(call.sql).toContain('NULLS LAST'); expect(call.sql).toContain('LIMIT ?');
    expect(call.values).toContain('live:a'); expect(call.values).toContain('Farmstok'); expect(call.values).toContain('LIVE'); expect(call.values).toContain(0.7); expect(call.values).toContain(4);
    expect(String(call.values[0])).toMatch(/^\[/u); expect(call.sql).not.toContain('[0.1,0.1');
  });
});

describe('rota e CLI', () => {
  it('rota retorna 400, 200 sem embeddings e 503 seguro', async () => {
    const app = Fastify(); app.register(createKnowledgeVectorSearchRoutes(new KnowledgeVectorSearchService(fakeRepository(0), vi.fn())), { prefix: '/api/knowledge' });
    expect((await app.inject({ method: 'GET', url: '/api/knowledge/vector-search?q=' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: '/api/knowledge/vector-search?q=abc' })).json().reason).toBe('NO_EMBEDDINGS_AVAILABLE'); await app.close();
    const unavailable = Fastify(); unavailable.register(createKnowledgeVectorSearchRoutes(new KnowledgeVectorSearchService(fakeRepository(1), () => { throw new EmbeddingProviderUnavailableError(); })), { prefix: '/api/knowledge' });
    const response = await unavailable.inject({ method: 'GET', url: '/api/knowledge/vector-search?q=abc' }); expect(response.statusCode).toBe(503); expect(response.json()).toEqual({ error: 'EMBEDDING_PROVIDER_UNAVAILABLE', message: expect.any(String) }); await unavailable.close();
  });
  it('parser aceita filtros e rejeita desconhecido', () => {
    expect(parseVectorSearchCliArgs(['abc', '--limit', '3', '--source-key', 'live:a', '--course', 'Farmstok', '--type', 'LIVE', '--min-similarity', '0.6'])).toMatchObject({ q: 'abc', limit: '3', sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: '0.6' });
    expect(parseVectorSearchCliArgs(['abc', '--x', '1'])).toBeNull();
  });
});
