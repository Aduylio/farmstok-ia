import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('POST /api/knowledge/ask', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildApp(); await app.ready(); });
  afterAll(async () => app.close());

  it.each([{ question: '' }, {}, { question: 12345 }])('retorna 400 para entrada invalida %#', async (payload) => {
    const response = await app.inject({ method: 'POST', url: '/api/knowledge/ask', payload });
    expect(response.statusCode).toBe(400); expect(response.json().error).toBe('INVALID_REQUEST');
  });
});
