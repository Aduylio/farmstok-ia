import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { createKnowledgeSearchRoutes } from '../src/modules/knowledge/knowledge-search.routes.js';
import { KnowledgeSearchService } from '../src/modules/knowledge/knowledge-search.service.js';

async function createApp(service?: KnowledgeSearchService) {
  const app = Fastify({ logger: false });
  const routeService =
    service ??
    new KnowledgeSearchService({
      async findCandidates() {
        return [];
      },
    });

  app.register(createKnowledgeSearchRoutes(routeService), {
    prefix: '/api/knowledge',
  });
  await app.ready();
  return app;
}

describe('GET /api/knowledge/search', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('exige query q', async () => {
    app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/api/knowledge/search' });
    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe('INVALID_REQUEST');
  });

  it('rejeita query vazia', async () => {
    app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/knowledge/search?q=%20%20',
    });
    expect(response.statusCode).toBe(400);
  });

  it('aplica limite padrão 5 e aceita máximo 20', async () => {
    app = await createApp();
    const defaultResponse = await app.inject({
      method: 'GET',
      url: '/api/knowledge/search?q=estoque',
    });
    const maxResponse = await app.inject({
      method: 'GET',
      url: '/api/knowledge/search?q=estoque&limit=20',
    });
    const invalidResponse = await app.inject({
      method: 'GET',
      url: '/api/knowledge/search?q=estoque&limit=21',
    });

    expect(defaultResponse.statusCode).toBe(200);
    expect(maxResponse.statusCode).toBe(200);
    expect(invalidResponse.statusCode).toBe(400);
  });

  it('retorna 500 seguro quando o service falha', async () => {
    app = await createApp(
      new KnowledgeSearchService({
        async findCandidates() {
          throw new Error('SQL secreto e credencial');
        },
      }),
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/knowledge/search?q=estoque',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('SQL secreto');
    expect(response.json<{ error: string }>().error).toBe('INTERNAL_ERROR');
  });
});
