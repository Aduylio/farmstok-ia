import { describe, expect, it } from 'vitest';

import type {
  CreateSourceWithChunksInput,
  KnowledgeIngestionRepository,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.repository.js';
import { KnowledgeIngestionService } from '../src/modules/knowledge-ingestion/knowledge-ingestion.service.js';

class RecordingRepository implements KnowledgeIngestionRepository {
  input: CreateSourceWithChunksInput | undefined;

  async createSourceWithChunks(input: CreateSourceWithChunksInput) {
    this.input = input;

    return {
      source: {
        id: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
        type: input.source.type,
        title: input.source.title,
        course: input.source.course,
      },
      chunksCreated: input.chunks.length,
    };
  }
}

describe('KnowledgeIngestionService', () => {
  it('prepara e cria a fonte e seus chunks', async () => {
    const repository = new RecordingRepository();
    const service = new KnowledgeIngestionService(repository);
    const content = `${'A'.repeat(700)}\n\n${'B'.repeat(700)}`;

    const result = await service.ingest({
      type: 'AULA',
      title: 'Curva ABC',
      course: 'Farmstok',
      module: 'Gestão de Estoques',
      lessonNumber: 1,
      sourceUrl: 'https://exemplo.com/aula',
      instructor: 'Nome do instrutor',
      content,
    });

    expect(repository.input?.chunks).toHaveLength(2);
    expect(repository.input?.chunks[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(repository.input?.chunks[0]?.tokenCount).toBeGreaterThan(0);
    expect(repository.input?.source.module).toBe('Gestão de Estoques');
    expect(result.source.title).toBe('Curva ABC');
    expect(result.ingestion).toEqual({
      chunksCreated: 2,
      charactersProcessed: content.length,
    });
  });

  it('remove chunks duplicados dentro da mesma fonte', async () => {
    const repository = new RecordingRepository();
    const service = new KnowledgeIngestionService(repository);
    const repeatedContent = 'conteudo-sem-espacos-'.repeat(60);

    await service.ingest({
      type: 'FAQ',
      title: 'Conteúdo repetido',
      course: 'Farmstok',
      content: `${repeatedContent}\n\n${repeatedContent}`,
    });

    expect(repository.input?.chunks).toHaveLength(1);
  });
});
