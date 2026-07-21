import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { parseHybridSearchCliArgs } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.cli.js';
import { createKnowledgeHybridSearchRoutes } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.routes.js';
import { knowledgeHybridSearchQuerySchema } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.schemas.js';
import { KnowledgeHybridSearchService } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.service.js';
import type { TextSearchService, VectorSearchService } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.types.js';
import { BOTH_MATCH_BONUS, HYBRID_CANDIDATE_MULTIPLIER, calculateHybridScore, hybridCandidateLimit, normalizeTextScores, normalizeWeights } from '../src/modules/knowledge-hybrid-search/knowledge-hybrid-search.utils.js';

const source = { id: 's1', sourceKey: 'live:a', type: 'LIVE' as const, title: 'Live', course: 'Farmstok', module: null, sourceUrl: 'https://youtube.com/watch?v=x', timestampUrl: 'https://youtube.com/watch?v=x&t=10s' };
const textResult = (chunkId: string, score: number, sourceKey = 'live:a') => ({ chunkId, content: `texto ${chunkId}`, score, startTime: '00:00:10', endTime: null, source: { ...source, sourceKey } });
const vectorResult = (chunkId: string, similarity: number, sourceKey = 'live:a') => ({ chunkId, content: `texto ${chunkId}`, similarity, startTime: '00:00:10', endTime: null, source: { ...source, sourceKey } });
function services(textResults = [textResult('a', 10)], vectorResults = [vectorResult('a', 0.8)], vectorReason: 'NO_EMBEDDINGS_AVAILABLE' | 'NO_RELEVANT_RESULTS' | null = null) {
  const text: TextSearchService & { search: ReturnType<typeof vi.fn> } = { search: vi.fn().mockResolvedValue({ query: 'q', results: textResults, total: textResults.length }) };
  const vector: VectorSearchService & { search: ReturnType<typeof vi.fn> } = { search: vi.fn().mockResolvedValue({ query: 'q', results: vectorResults, total: vectorResults.length, reason: vectorReason }) };
  return { text, vector };
}
const input = { q: 'estoque', limit: 5, minSimilarity: 0, textWeight: 0.4, vectorWeight: 0.6 };

describe('pesos e normalizacao', () => {
  it('aplica pesos padrao', () => expect(knowledgeHybridSearchQuerySchema.parse({ q: 'a' })).toMatchObject({ textWeight: 0.4, vectorWeight: 0.6 }));
  it('normaliza pesos que nao somam um', () => expect(normalizeWeights(0.2, 0.3)).toEqual({ textWeight: 0.4, vectorWeight: 0.6 }));
  it.each([{ q: 'a', textWeight: 0, vectorWeight: 0 }, { q: 'a', textWeight: -1 }, { q: 'a', vectorWeight: 1.1 }])('rejeita pesos invalidos %#', (value) => expect(knowledgeHybridSearchQuerySchema.safeParse(value).success).toBe(false));
  it('normaliza score textual por maximo', () => expect(normalizeTextScores([10, 5, 0])).toEqual([1, 0.5, 0]));
  it('scores textuais iguais permanecem equivalentes', () => expect(normalizeTextScores([7, 7])).toEqual([1, 1]));
  it('bonus duplo e score limitado', () => { expect(BOTH_MATCH_BONUS).toBe(0.05); expect(calculateHybridScore(1, 1, 0.4, 0.6, true)).toBe(1); });
  it('usa multiplicador com teto dos services', () => { expect(HYBRID_CANDIDATE_MULTIPLIER).toBe(4); expect(hybridCandidateLimit(5)).toBe(20); expect(hybridCandidateLimit(20)).toBe(20); });
});

describe('combinacao hibrida', () => {
  it('combina pelo chunkId, marca ambas e aplica bonus', async () => { const s = services(); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search(input); expect(result.results[0]).toMatchObject({ chunkId: 'a', textScore: 1, vectorScore: 0.8, matchedBy: ['TEXT', 'VECTOR'], hybridScore: 0.93 }); expect(result.mode).toBe('HYBRID'); });
  it('mantem somente textual e somente vetorial', async () => { const s = services([textResult('t', 2)], [vectorResult('v', 0.9)]); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search(input); expect(result.results.map((r) => r.matchedBy)).toEqual(expect.arrayContaining([['TEXT'], ['VECTOR']])); });
  it('retorna VECTOR_ONLY quando texto vazio', async () => { const s = services([], [vectorResult('v', 0.9)]); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search(input); expect(result.mode).toBe('VECTOR_ONLY'); });
  it('zero embeddings retorna fallback textual sem falhar', async () => { const s = services([textResult('t', 2)], [], 'NO_EMBEDDINGS_AVAILABLE'); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search(input); expect(result).toMatchObject({ mode: 'TEXT_ONLY', reason: 'VECTOR_UNAVAILABLE' }); expect(result.results[0]?.source.timestampUrl).toContain('t=10s'); });
  it('resultados vazios retornam NO_RELEVANT_RESULTS', async () => { const s = services([], [], 'NO_EMBEDDINGS_AVAILABLE'); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search(input); expect(result).toMatchObject({ results: [], total: 0, mode: 'TEXT_ONLY', reason: 'NO_RELEVANT_RESULTS' }); });
  it('propaga filtros e busca candidatos extras', async () => { const s = services([], [], null); await new KnowledgeHybridSearchService(s.text, s.vector).search({ ...input, limit: 3, sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: 0.7 }); expect(s.text.search).toHaveBeenCalledWith({ q: 'estoque', limit: 12, sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE' }); expect(s.vector.search).toHaveBeenCalledWith({ q: 'estoque', limit: 12, sourceKey: 'live:a', course: 'Farmstok', type: 'LIVE', minSimilarity: 0.7 }); });
  it('aplica limit final e desempate deterministico', async () => { const s = services([textResult('b', 1, 'live:b'), textResult('a', 1, 'live:a')], [], null); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search({ ...input, limit: 1 }); expect(result.results).toHaveLength(1); expect(result.results[0]?.chunkId).toBe('a'); expect(result.total).toBe(2); });
  it('prioriza dupla correspondencia no empate', async () => { const s = services([textResult('both', 1), textResult('text', 1)], [vectorResult('both', 0), vectorResult('vector', 0)]); const result = await new KnowledgeHybridSearchService(s.text, s.vector).search({ ...input, textWeight: 1, vectorWeight: 0 }); expect(result.results[0]?.chunkId).toBe('both'); });
});

describe('rota e CLI', () => {
  it('route handler valida e sanitiza erros', async () => { const s = services([], [], 'NO_EMBEDDINGS_AVAILABLE'); const app = Fastify(); app.register(createKnowledgeHybridSearchRoutes(new KnowledgeHybridSearchService(s.text, s.vector)), { prefix: '/api/knowledge' }); expect((await app.inject({ method: 'GET', url: '/api/knowledge/hybrid-search?q=' })).statusCode).toBe(400); expect((await app.inject({ method: 'GET', url: '/api/knowledge/hybrid-search?q=abc' })).json()).toMatchObject({ mode: 'TEXT_ONLY' }); await app.close(); const broken = Fastify(); broken.register(createKnowledgeHybridSearchRoutes(new KnowledgeHybridSearchService({ search: vi.fn().mockRejectedValue(new Error('segredo')) }, s.vector)), { prefix: '/api/knowledge' }); const response = await broken.inject({ method: 'GET', url: '/api/knowledge/hybrid-search?q=abc' }); expect(response.statusCode).toBe(500); expect(response.body).not.toContain('segredo'); await broken.close(); });
  it('parser aceita todas as opcoes e rejeita desconhecida', () => { expect(parseHybridSearchCliArgs(['abc', '--limit', '3', '--source-key', 'live:a', '--course', 'Farmstok', '--type', 'LIVE', '--min-similarity', '0.5', '--text-weight', '0.3', '--vector-weight', '0.7'])).toMatchObject({ q: 'abc', limit: '3', sourceKey: 'live:a', textWeight: '0.3', vectorWeight: '0.7' }); expect(parseHybridSearchCliArgs(['abc', '--x', '1'])).toBeNull(); });
});
