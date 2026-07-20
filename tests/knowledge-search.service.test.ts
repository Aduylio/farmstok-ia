import { describe, expect, it, vi } from 'vitest';

import type {
  KnowledgeSearchCandidate,
  KnowledgeSearchRepository,
} from '../src/modules/knowledge/knowledge-search.repository.js';
import {
  KNOWLEDGE_SEARCH_CANDIDATE_LIMIT,
  KnowledgeSearchService,
} from '../src/modules/knowledge/knowledge-search.service.js';

function candidate(
  id: string,
  sourceKey: string,
  startTime: string | null,
  content = 'estoque mínimo',
): KnowledgeSearchCandidate {
  return {
    id,
    content,
    startTime,
    endTime: null,
    source: {
      id: `source-${sourceKey}`,
      sourceKey,
      type: 'LIVE',
      title: 'Webinar Trier',
      course: 'Farmstok',
      module: 'Compras',
      sourceUrl: 'https://youtu.be/abc',
    },
  };
}

describe('KnowledgeSearchService', () => {
  it('usa limite padrão, teto de candidatos e busca case-insensitive', async () => {
    const findCandidates = vi.fn(async () => [
      candidate('chunk-1', 'live:trier', '00:01:00', 'ESTOQUE MÍNIMO'),
    ]);
    const service = new KnowledgeSearchService({ findCandidates });

    const response = await service.search({ q: 'estoque mínimo', limit: 5 });

    expect(response.results).toHaveLength(1);
    expect(findCandidates).toHaveBeenCalledWith(
      { sourceKey: undefined, course: undefined, type: undefined },
      KNOWLEDGE_SEARCH_CANDIDATE_LIMIT,
    );
  });

  it('ordena por score, sourceKey, startTime e chunkId e limita depois', async () => {
    const repository: KnowledgeSearchRepository = {
      async findCandidates() {
        return [
          candidate('chunk-b', 'live:b', '00:02:00'),
          candidate('chunk-c', 'live:a', '00:02:00'),
          candidate('chunk-a', 'live:a', '00:01:00'),
          candidate('chunk-zero', 'live:a', null, 'sem relação'),
        ];
      },
    };
    const service = new KnowledgeSearchService(repository);

    const response = await service.search({ q: 'estoque mínimo', limit: 2 });

    expect(response.total).toBe(3);
    expect(response.results.map((result) => result.chunkId)).toEqual([
      'chunk-a',
      'chunk-c',
    ]);
  });

  it('encaminha filtros por sourceKey, course e type', async () => {
    const findCandidates = vi.fn(async () => []);
    const service = new KnowledgeSearchService({ findCandidates });

    await service.search({
      q: 'compras',
      limit: 20,
      sourceKey: 'live:trier',
      course: 'Farmstok',
      type: 'LIVE',
    });

    expect(findCandidates).toHaveBeenCalledWith(
      {
        sourceKey: 'live:trier',
        course: 'Farmstok',
        type: 'LIVE',
      },
      500,
    );
  });

  it('retorna resultado vazio com HTTP semantics de sucesso no service', async () => {
    const service = new KnowledgeSearchService({
      async findCandidates() {
        return [candidate('chunk-1', 'live:a', null, 'conteúdo irrelevante')];
      },
    });

    await expect(service.search({ q: 'xyzabc123', limit: 5 })).resolves.toEqual({
      query: 'xyzabc123',
      results: [],
      total: 0,
    });
  });
});
