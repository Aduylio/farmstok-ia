import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import {
  DuplicateKnowledgeChunkError,
  type CreateSourceWithChunksInput,
  type KnowledgeIngestionRepository,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.repository.js';
import { createKnowledgeIngestionRoutes } from '../src/modules/knowledge-ingestion/knowledge-ingestion.routes.js';
import { KnowledgeIngestionService } from '../src/modules/knowledge-ingestion/knowledge-ingestion.service.js';

class SuccessfulRepository implements KnowledgeIngestionRepository {
  async findSourceByKey(): Promise<{ id: string } | null> {
    return null;
  }

  async createSourceWithChunks(input: CreateSourceWithChunksInput) {
    return {
      source: {
        id: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
        sourceKey: input.source.sourceKey,
        type: input.source.type,
        title: input.source.title,
        course: input.source.course,
      },
      chunksCreated: input.chunks.length,
    };
  }
}

class ConflictingRepository implements KnowledgeIngestionRepository {
  async findSourceByKey(): Promise<{ id: string } | null> {
    return null;
  }

  async createSourceWithChunks(): Promise<never> {
    throw new DuplicateKnowledgeChunkError();
  }
}

class FailingRepository implements KnowledgeIngestionRepository {
  async findSourceByKey(): Promise<{ id: string } | null> {
    return null;
  }

  async createSourceWithChunks(): Promise<never> {
    throw new Error('detalhe interno que não pode ser exposto');
  }
}

async function createApp(
  repository: KnowledgeIngestionRepository = new SuccessfulRepository(),
) {
  const app = Fastify({ logger: false });
  const service = new KnowledgeIngestionService(repository);

  app.register(createKnowledgeIngestionRoutes(service), {
    prefix: '/api/knowledge',
  });
  await app.ready();

  return app;
}

describe('POST /api/knowledge/sources', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('retorna a fonte criada e o resumo da ingestao', async () => {
    app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/sources',
      payload: {
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
        module: 'Gestão de Estoques',
        lessonNumber: 1,
        sourceUrl: 'https://exemplo.com/aula',
        instructor: 'Nome do instrutor',
        content: 'Texto completo da aula.',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      source: {
        id: '3e1e04ad-32e5-4eed-b131-e72f16f063b7',
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
      },
      ingestion: {
        chunksCreated: 1,
        charactersProcessed: 23,
      },
    });
  });

  it('rejeita conteudo vazio com HTTP 400', async () => {
    app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/sources',
      payload: {
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
        content: '   ',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe('INVALID_REQUEST');
  });

  it('rejeita payload invalido com HTTP 400', async () => {
    app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/sources',
      payload: {
        sourceKey: 'aula:curva-abc',
        type: 'TIPO_INEXISTENTE',
        content: 'Conteúdo válido.',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe('INVALID_REQUEST');
  });

  it('retorna HTTP 409 para conflito de duplicidade', async () => {
    app = await createApp(new ConflictingRepository());

    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/sources',
      payload: {
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
        content: 'Conteúdo válido.',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'DUPLICATE_CONTENT',
      message: 'Um ou mais chunks já existem nesta fonte.',
    });
  });

  it('retorna HTTP 500 sem expor detalhes internos', async () => {
    app = await createApp(new FailingRepository());

    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/sources',
      payload: {
        sourceKey: 'aula:curva-abc',
        type: 'AULA',
        title: 'Curva ABC',
        course: 'Farmstok',
        content: 'Conteúdo válido.',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('detalhe interno');
    expect(response.json()).toEqual({
      error: 'INTERNAL_ERROR',
      message: 'Não foi possível cadastrar a fonte de conhecimento.',
    });
  });
});
